
import { StateObject, TenderlySimulatePayload, TenderlySimulation } from './common';
import { _getSingleTransactionPayload, ownerAddress, rpcUrl, SimulationTxParams } from './config/utilis';
import axios from 'axios';

import { ethers, toBeHex } from 'ethers';


export type EnvState = {
    tenderly: {
      url: string
      accessToken: string
    }
    rpc: {
      [chainId: string]: string
    }
  }

  

const TENDERLY_SIMULATE_ENDPOINT_URL = 'https://api.tenderly.co/api/v1/simulate';

export const getSimulation = async (
  tx: TenderlySimulatePayload,
  customTenderly: EnvState['tenderly'] | undefined,
): Promise<TenderlySimulation> => {
  const config = {
    method: 'POST',
    url: customTenderly?.url ? customTenderly.url : TENDERLY_SIMULATE_ENDPOINT_URL,
    data: tx,
    headers: customTenderly?.accessToken
      ? {
          'content-type': 'application/JSON',
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
};


const getLatestBlockGasLimit = async (): Promise<number> => {
  // Replace with your Ethereum provider URL
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const latestBlock = await provider.getBlock('latest');
  const gasLimit = Number(latestBlock?.gasLimit);
  
  if (!latestBlock) {
    throw new Error('Could not determine block gas limit');
  }

  return gasLimit;
};


export const _getStateOverride = (
    address: string,
    balance?: string,
    code?: string,
    storage?: Record<string, string>,
  ): Record<string, StateObject> => {
    return {
      [address]: {
        balance,
        code,
        storage,
      },
    }
  }
  

  
  /**
   * @returns true for single MultiSig transactions if the provided signatures plus the current owner's signature (if missing)
   * do not reach the safe's threshold.
   */
  const isOverwriteThreshold = (params: SimulationTxParams) => {

    const tx = params.transactions
    const hasOwnerSig = tx.signatures.has(params.executionOwner)
    const effectiveSigs = tx.signatures.size + (hasOwnerSig ? 0 : 1)
    return params.safe.threshold > effectiveSigs
  }
  
  const getNonceOverwrite = (params: SimulationTxParams): number | undefined => {
    const txNonce = params.transactions.data.nonce
    const safeNonce = params.safe.nonce
    if (txNonce > safeNonce) {
      return txNonce
    }
  }
  
  /* We need to overwrite the threshold stored in smart contract storage to 1
    to do a proper simulation that takes transaction guards into account.
    The threshold is stored in storage slot 4 and uses full 32 bytes slot.
    Safe storage layout can be found here:
    https://github.com/gnosis/safe-contracts/blob/main/contracts/libraries/GnosisSafeStorage.sol */
  export const THRESHOLD_STORAGE_POSITION = toBeHex('0x4', 32)
  export const THRESHOLD_OVERWRITE = toBeHex('0x1', 32)
  /* We need to overwrite the nonce if we simulate a (partially) signed transaction which is not at the top position of the tx queue.
    The nonce can be found in storage slot 5 and uses a full 32 bytes slot. */
  export const NONCE_STORAGE_POSITION = toBeHex('0x5', 32)
  
  const getStateOverwrites = (params: SimulationTxParams) => {
    const nonceOverwrite = getNonceOverwrite(params)
    const isThresholdOverwrite = isOverwriteThreshold(params)
  
    const storageOverwrites: Record<string, string> = {} as Record<string, string>
  
    if (isThresholdOverwrite) {
      storageOverwrites[THRESHOLD_STORAGE_POSITION] = THRESHOLD_OVERWRITE
    }
    if (nonceOverwrite !== undefined) {
      storageOverwrites[NONCE_STORAGE_POSITION] = toBeHex('0x' + BigInt(nonceOverwrite).toString(16), 32)
    }
  
    return storageOverwrites
  }

export const getSimulationPayload = async (params: SimulationTxParams): Promise<TenderlySimulatePayload> => {
    const gasLimit = params.gasLimit ?? (await getLatestBlockGasLimit())
  
    const payload = await _getSingleTransactionPayload()
  
    const stateOverwrites = getStateOverwrites(params)
    const stateOverwritesLength = Object.keys(stateOverwrites).length
  
    return {
      ...payload,
      network_id: params.safe.chainId,
      from: ownerAddress,
      gas: gasLimit,
      // With gas price 0 account don't need token for gas
      gas_price: '0',
      state_objects:
        stateOverwritesLength > 0
          ? _getStateOverride(params.safe.address.value, undefined, undefined, stateOverwrites)
          : undefined,
      save: true,
      save_if_fails: true,
    }
  }
