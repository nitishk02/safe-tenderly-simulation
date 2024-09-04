import EthSafeTransaction from '@safe-global/protocol-kit/dist/src/utils/transactions/SafeTransaction';
import { SafeTransaction, type SafeTransactionData } from '@safe-global/safe-core-sdk-types';
import { type SafeInfo } from '@safe-global/safe-gateway-typescript-sdk';
import Safe from '@safe-global/protocol-kit';
import { getSafeContractInstance } from '@safe-global/protocol-kit/dist/src/contracts/contractInstances';
import { pereValidateSignature } from '../gnosisHelper';
import { TenderlySimulatePayload } from '../common';
import SafeApiKit from '@safe-global/api-kit'

type SingleTransactionSimulationParams = {
  safe: SafeInfo;
  executionOwner: string;
  transactions: SafeTransaction;
  gasLimit?: number;
};



export type SimulationTxParams = SingleTransactionSimulationParams ;

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

export const rpcUrl="https://rpc.ankr.com/eth_sepolia/4b2763e373412067b180bf777ad9c87d5c6c7f1bfd6bd920db9a1cbf885263e2"

export const safeAddress = '0xa08E15EEEAE9C486b190DC78C91E63C705867665';
export const ownerAddress = '0x9C9574c538D982B44555Aa7382FFb8c911c1bE1b';
export const apiKit = new SafeApiKit({
    chainId: 11155111n,
  })
export async function _getSingleTransactionPayload(): Promise<Pick<TenderlySimulatePayload, 'to' | 'input'>> {
    const protocolKit = await Safe.init({
        provider: rpcUrl,
        signer:undefined,
        safeAddress: safeAddress,
    });

    const version = await protocolKit.getContractVersion();
    const safeProvider = protocolKit.getSafeProvider();
    const readOnlySafeContract = await getSafeContractInstance(version, safeProvider, safeAddress);

    const signature = await pereValidateSignature(ownerAddress);
    const simulatedTransaction = new EthSafeTransaction(txParam);
    let transaction = simulatedTransaction;

    simulatedTransaction.addSignature(signature);
//@ts-ignore
    const input:string = readOnlySafeContract.encode('execTransaction', [
        transaction.data.to,
        transaction.data.value,
        transaction.data.data,
        transaction.data.operation,
        transaction.data.safeTxGas,
        transaction.data.baseGas,
        transaction.data.gasPrice,
        transaction.data.gasToken,
        transaction.data.refundReceiver,
        transaction.encodedSignatures(),
    ]);


 return {
        to: await readOnlySafeContract.getAddress(),
        input,
    }
}
