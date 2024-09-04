import { _getSingleTransactionPayload, apiKit, ownerAddress, safeAddress, SimulationTxParams } from "./config/utilis";
import { pereValidateSignature } from "./gnosisHelper";
import { getSimulation, getSimulationPayload } from "./simulation";

const tenderly = {
    url: 'https://api.tenderly.co/api/v1/account/nitishk02/project/test/simulate',
    accessToken: "ov4sW5ojOcTCxKVX97-5loZmVb2XA9uW"
}
let params: any;

async function main() {

    _getSingleTransactionPayload()
    const SafeInfo= await apiKit.getSafeInfo(safeAddress);
    const signature = await pereValidateSignature(ownerAddress);

   params = {
        transactions: {
          signatures: new Set([signature]),
          data: {
            nonce: 0,
          },
        },
        safe: {
          address: {
            value: ownerAddress,
          },
          nonce: 0,
          threshold: 2,
          chainId: '11155111', 
        },
        executionOwner: ownerAddress,
        gasLimit: 210000, 
      };
      
    const simulationPayload = await getSimulationPayload(params)

    const data = await getSimulation(simulationPayload, tenderly)
    console.log(data)

}

main().catch(console.error);