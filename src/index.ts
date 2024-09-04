import { ethers } from 'ethers';
import axios from 'axios';
import SafeApiKit from '@safe-global/api-kit';
import Safe from '@safe-global/protocol-kit';
import EthSafeTransaction from '@safe-global/protocol-kit/dist/src/utils/transactions/SafeTransaction';
import { getSafeContractInstance } from '@safe-global/protocol-kit/dist/src/contracts/contractInstances';
import {  type SafeTransactionData } from '@safe-global/safe-core-sdk-types';
import { pereValidateSignature } from './gnosisHelper';
import { TenderlySimulatePayload, StateObject, TenderlySimulation } from './common';
import { SimulationTxParams } from './config/utilis';

export const rpcUrl = process.env.RPC_URL || "";
export const safeAddress = process.env.SAFE_ADDRESS || '0xa08E15EEEAE9C486b190DC78C91E63C705867665';
export const ownerAddress = process.env.OWNER_ADDRESS || '0x9C9574c538D982B44555Aa7382FFb8c911c1bE1b';
export const tenderly = {
    url: process.env.TENDERLY_URL || '',
    accessToken: process.env.TENDERLY_ACCESS_TOKEN 
};

const apiKit = new SafeApiKit({
    chainId: 11155111n,
});

const txParam: SafeTransactionData = {
    to: '0x9C9574c538D982B44555Aa7382FFb8c911c1bE1b',
    value: '1000000000000000',
    data: '0x',
    operation: 0,
    nonce: 0,
    safeTxGas: '0',
    baseGas: '0',
    gasPrice: '0',
    gasToken: '0x0000000000000000000000000000000000000000',
    refundReceiver: '0x0000000000000000000000000000000000000000',
};

const TENDERLY_SIMULATE_ENDPOINT_URL = 'https://api.tenderly.co/api/v1/simulate';
export const THRESHOLD_STORAGE_POSITION = ethers.toBeHex('0x4', 32);
export const THRESHOLD_OVERWRITE = ethers.toBeHex('0x1', 32);
export const NONCE_STORAGE_POSITION = ethers.toBeHex('0x5', 32);

export async function main(): Promise<void> {
    try {
        const safeInfo = await apiKit.getSafeInfo(safeAddress);
        const signature = await pereValidateSignature(safeInfo.owners[0]);
        console.log(safeInfo);
        const params: any = {
            transactions: {
                signatures: new Set([signature.data]),
                data: {
                    nonce: 0,
                },
            },
            safe: {
                address: {
                    value: safeInfo.address,
                },
                nonce: safeInfo.nonce,
                threshold: 2,
                chainId: '11155111',
            },
            executionOwner: ownerAddress,
            gasLimit: 210000,
        };

        const simulationPayload = await getSimulationPayload(params);
        const data = await getSimulation(simulationPayload, tenderly);
        console.log(data);
    } catch (error) {
        console.error('Error executing main function:', error);
    }
}

async function getSimulation(
    tx: TenderlySimulatePayload,
    customTenderly: Partial<{ url: string; accessToken: string }>
): Promise<TenderlySimulation> {
    const config = {
        method: 'POST',
        url: customTenderly?.url || TENDERLY_SIMULATE_ENDPOINT_URL,
        data: tx,
        headers: customTenderly?.accessToken
            ? {
                'Content-Type': 'application/JSON',
                'X-Access-Key': customTenderly.accessToken,
            }
            : undefined,
    };

    try {
        const response = await axios(config);
        return response.data as TenderlySimulation;
    } catch (error: any) {
        throw new Error(`${error.response?.status} - ${error.response?.statusText}: ${error.response?.data?.error?.message}`);
    }
}

async function getLatestBlockGasLimit(): Promise<number> {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const latestBlock = await provider.getBlock('latest');

    if (!latestBlock) {
        throw new Error('Could not determine block gas limit');
    }

    return Number(latestBlock.gasLimit);
}

export function _getStateOverride(
    address: string,
    balance?: string,
    code?: string,
    storage?: Record<string, string>
): Record<string, StateObject> {
    return {
        [address]: {
            balance,
            code,
            storage,
        },
    };
}

function isOverwriteThreshold(params: SimulationTxParams): boolean {
    const tx = params.transactions;
    const hasOwnerSig = tx.signatures.has(params.executionOwner);

    
    const effectiveSigs = tx.signatures.size + (!hasOwnerSig ? 0 : 1);
    return params.safe.threshold > effectiveSigs;
}

function getNonceOverwrite(params: SimulationTxParams): number | undefined {
    const txNonce = params.transactions.data.nonce;
    const safeNonce = params.safe.nonce;
    if (txNonce > safeNonce) {
        return txNonce;
    }
}

function getStateOverwrites(params: SimulationTxParams): Record<string, string> {
    const nonceOverwrite = getNonceOverwrite(params);
    const isThresholdOverwrite = isOverwriteThreshold(params);

    const storageOverwrites: Record<string, string> = {};

    if (isThresholdOverwrite) {
        storageOverwrites[THRESHOLD_STORAGE_POSITION] = THRESHOLD_OVERWRITE;
    }
    if (nonceOverwrite !== undefined) {
        storageOverwrites[NONCE_STORAGE_POSITION] = ethers.toBeHex('0x' + BigInt(nonceOverwrite).toString(16), 32);
    }

    return storageOverwrites;
}

export async function getSimulationPayload(params: SimulationTxParams): Promise<TenderlySimulatePayload> {
    const gasLimit = params.gasLimit ?? (await getLatestBlockGasLimit());

    const payload = await _getSingleTransactionPayload();

    const stateOverwrites = getStateOverwrites(params);
    const stateOverwritesLength = Object.keys(stateOverwrites).length;

    return {
        ...payload,
        network_id: params.safe.chainId,
        from: ownerAddress,
        gas: gasLimit,
        gas_price: '0',
        state_objects: stateOverwritesLength > 0
            ? _getStateOverride(params.safe.address.value, undefined, undefined, stateOverwrites)
            : undefined,
        save: true,
        save_if_fails: true,
    };
}

export async function _getSingleTransactionPayload(): Promise<Pick<TenderlySimulatePayload, 'to' | 'input'>> {
    const protocolKit = await Safe.init({
        provider: rpcUrl,
        signer: undefined,
        safeAddress,
    });

    const version = await protocolKit.getContractVersion();
    const safeProvider = protocolKit.getSafeProvider();
    const readOnlySafeContract = await getSafeContractInstance(version, safeProvider, safeAddress);

    const signature = await pereValidateSignature(ownerAddress);
    const simulatedTransaction = new EthSafeTransaction(txParam);

    simulatedTransaction.addSignature(signature);
    //@ts-ignore
    const input: string = readOnlySafeContract.encode('execTransaction', [
        simulatedTransaction.data.to,
        simulatedTransaction.data.value,
        simulatedTransaction.data.data,
        simulatedTransaction.data.operation,
        simulatedTransaction.data.safeTxGas,
        simulatedTransaction.data.baseGas,
        simulatedTransaction.data.gasPrice,
        simulatedTransaction.data.gasToken,
        simulatedTransaction.data.refundReceiver,
        simulatedTransaction.encodedSignatures(),
    ]);

    return {
        to: await readOnlySafeContract.getAddress(),
        input,
    };
}

main().catch(console.error);
