import { generatePreValidatedSignature } from '@safe-global/protocol-kit/dist/src/utils/signatures'
import { TypedDataUtils } from "eth-sig-util";
import { ethers } from 'ethers';
import { SafeInfo } from '@safe-global/safe-gateway-typescript-sdk';

export const pereValidateSignature = (ownerAddress:string) => {
    const ownerPerValidateSignature = generatePreValidatedSignature(ownerAddress);
    return  ownerPerValidateSignature ;
};


export function generateSafeTxHash(
    safeAddress: string,
    version: string,
    networkId: number,
    txArgs: any
): string {
    const EIP712_DOMAIN = [
        {
            type: "uint256",
            name: "chainId",
        },
        {
            type: "address",
            name: "verifyingContract",
        },
    ];

    const EIP712_DOMAIN_BEFORE_V130 = [
        {
            type: "address",
            name: "verifyingContract",
        },
    ];

    let eip712WithChainId = false;
    if (version == "1.3.0") {
        eip712WithChainId = true;
    }
    if (version.includes("1.3.0")) {
        eip712WithChainId = true;
    }
    if (version.includes("1.3.1")) {
        eip712WithChainId = true;
    }
    if (version == "1.3.1") {
        eip712WithChainId = true;
    }

    const messageTypes = {
        EIP712Domain: eip712WithChainId ? EIP712_DOMAIN : EIP712_DOMAIN_BEFORE_V130,
        SafeTx: [
            { type: "address", name: "to" },
            { type: "uint256", name: "value" },
            { type: "bytes", name: "data" },
            { type: "uint8", name: "operation" },
            { type: "uint256", name: "safeTxGas" },
            { type: "uint256", name: "baseGas" },
            { type: "uint256", name: "gasPrice" },
            { type: "address", name: "gasToken" },
            { type: "address", name: "refundReceiver" },
            { type: "uint256", name: "nonce" },
        ],
    };

    const primaryType: "SafeTx" = "SafeTx" as const;

    const typedData = {
        types: messageTypes,
        domain: {
            chainId: eip712WithChainId ? networkId : undefined,
            verifyingContract: safeAddress,
        },
        primaryType,
        message: {
            to: txArgs.to,
            value: txArgs.value,
            data: txArgs.data,
            operation: txArgs.operation,
            safeTxGas: txArgs.safeTxGas,
            baseGas: txArgs.baseGas,
            gasPrice: txArgs.gasPrice,
            gasToken: txArgs.gasToken,
            refundReceiver: txArgs.refundReceiver,
            nonce: txArgs.nonce,
        },
    };

    return `0x${TypedDataUtils.sign<typeof messageTypes>(typedData).toString("hex")}`;
}


