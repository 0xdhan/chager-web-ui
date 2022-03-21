import * as Dialog from "@radix-ui/react-dialog";
import { BigNumber, ethers } from "ethers";
import { FunctionComponent, useCallback, useState } from "react";
import { useMutation, useQuery } from "react-query";
import { MultiCallContract, MulticallProvider } from "../../utils/MulticallProvider";
import Button from "../Buttons/Button";
import { useWalletContext } from "../Wallet";
import { VaultBaseInfo } from "./useVaultApi";
import ERC20ABI from "../../abis/ERC20.json";
import { TransactionReceipt } from "@ethersproject/abstract-provider";
import Link from "next/link";
import { getExplorerTxLink } from "../Explorer";
import toast from "react-hot-toast";

type MintTokenButtonProps = {
    vault: VaultBaseInfo;
};
const MintTokenButton: FunctionComponent<MintTokenButtonProps> = ({ vault }) => {
    // Global states
    const { account, chain, provider, signer } = useWalletContext();

    const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState("");

    const getTokenInfo = useCallback(
        async (token: string, account: string, spender: string) => {
            const multicallProvider = new MulticallProvider(provider, chain.chain.id);
            const contract = new MultiCallContract(token, ERC20ABI);
            const data = await multicallProvider.allDict([
                {
                    symbol: contract.symbol(),
                    decimals: contract.decimals(),
                    balance: contract.balanceOf(account),
                    allowance: contract.allowance(account, spender),
                },
            ]);
            return data[0];
        },
        [chain.chain.id, provider]
    );

    const {
        data: tokenInfo,
        isLoading,
        refetch: refetchTokenInfo,
    } = useQuery(
        `VaultActions:TokenInfo:${vault.vault}:${account}`,
        async () => {
            const data = await getTokenInfo(vault.tokenAddress, account || "", vault.vault);
            return {
                symbol: data.symbol,
                decimals: data.decimals,
                balance: data.balance,
                allowance: data.allowance,
                balanceFormatted: ethers.utils.formatUnits(data.balance, data.decimals),
                allowanceFormatted: ethers.utils.formatUnits(data.allowance, data.decimals),
            };
        },
        {
            enabled: !!account && open,
            retry: false,
        }
    );

    const mint = useMutation(async (args: { token: string; data: any; amount: BigNumber; amountFormatted: string | number }) => {
        const contract = new ethers.Contract(
            args.token,
            [
                {
                    inputs: [
                        {
                            internalType: "uint256",
                            name: "amount",
                            type: "uint256",
                        },
                    ],
                    name: "mint",
                    outputs: [],
                    stateMutability: "nonpayable",
                    type: "function",
                },
            ],
            signer
        );
        try {
            const transactionResponse = await contract.mint(args.amount);
            const receiptPromise = transactionResponse.wait();
            toast.promise(
                receiptPromise,
                {
                    loading: `Minting ${Number(args.amountFormatted).toFixed(4)} ${args.data.symbol}...`,
                    success: (receipt: TransactionReceipt) => {
                        return (
                            <div className="flex flex-row items-center">
                                <div className="flex flex-col">
                                    <b className="mb-1">{`Successfully mint ${Number(args.amountFormatted).toLocaleString("en-US", { maximumFractionDigits: 8 })} ${args.data?.symbol}`}</b>
                                    <a href={getExplorerTxLink(chain.chain, receipt.transactionHash)} target="_blank" rel="noreferrer" className="text-gray-text-center text-sm leading-6 text-gray-light-10 dark:text-gray-dark-10">
                                        <span className="hover:underline">{receipt.status === 1 ? "Transaction is submitted" : "Something wrong with the receipt"}</span> &#8599;
                                    </a>
                                </div>
                            </div>
                        );
                    },
                    error: (error) => {
                        return (
                            <div className="flex flex-row items-center">
                                <div className="flex flex-col">
                                    <b className="mb-1">{`Mint failed`}</b>
                                    <div>{error.message}</div>
                                </div>
                            </div>
                        );
                    },
                },
                {
                    loading: {
                        duration: Infinity,
                    },
                    success: {
                        duration: 10000,
                    },
                }
            );
            const receipt = await receiptPromise;
            refetchTokenInfo();
            return receipt;
        } catch (error: any) {
            toast.error(
                <div className="flex flex-row items-center">
                    <div className="flex flex-col">
                        <b className="mb-1">{`Mint failed`}</b>
                        <div>{error.message}</div>
                    </div>
                </div>
            );
            return null;
        }
    });

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(value) => {
                setOpen(value);
            }}
        >
            <Dialog.Trigger asChild>
                <Button>Mint</Button>
            </Dialog.Trigger>
            <Dialog.Overlay className="fixed inset-0 z-30 bg-gray-dark-1/60 backdrop-blur dark:bg-black/60" />
            <Dialog.Content className="fixed left-0 bottom-0 z-30 w-screen sm:flex sm:h-screen sm:items-center">
                {/* Mint or Redeem container */}
                <div className="mx-4 mx-auto mb-4 flex-col border-2 border-[#E93BF8] bg-gray-dark-1 p-4 sm:m-auto sm:max-w-[376px] sm:flex-auto">
                    <Dialog.Title className="mb-4 flex flex-row items-center justify-between">
                        <div className="flex flex-row items-center space-x-4">
                            <div>
                                <h1 className="m-0 text-left text-base font-bold tracking-[-0.02em] text-gray-light-12 dark:text-gray-dark-12">Mint</h1>
                                <p className="text-sm leading-4 text-gray-light-10 dark:text-gray-dark-10">Mint TestToken {vault.tokenName}</p>
                            </div>
                        </div>
                        <Dialog.Close
                            asChild
                            onClick={() => {
                                setReceipt(null);
                                setInputValue("");
                            }}
                        >
                            <button className="button basic h-[32px] p-0">
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="m-[9.5px] h-[11px] w-[11px] fill-gray-light-12 dark:fill-gray-dark-12">
                                    <path
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                        d="M12.8536 2.85355C13.0488 2.65829 13.0488 2.34171 12.8536 2.14645C12.6583 1.95118 12.3417 1.95118 12.1464 2.14645L7.5 6.79289L2.85355 2.14645C2.65829 1.95118 2.34171 1.95118 2.14645 2.14645C1.95118 2.34171 1.95118 2.65829 2.14645 2.85355L6.79289 7.5L2.14645 12.1464C1.95118 12.3417 1.95118 12.6583 2.14645 12.8536C2.34171 13.0488 2.65829 13.0488 2.85355 12.8536L7.5 8.20711L12.1464 12.8536C12.3417 13.0488 12.6583 13.0488 12.8536 12.8536C13.0488 12.6583 13.0488 12.3417 12.8536 12.1464L8.20711 7.5L12.8536 2.85355Z"
                                    />
                                </svg>
                            </button>
                        </Dialog.Close>
                    </Dialog.Title>

                    {!receipt && !account && <div className="mt-20 mb-20 text-sm text-gray-300">Please connect your wallet first.</div>}
                    {!receipt && account && (
                        <div className="mt-12 flex flex-col">
                            <div className="mb-1">
                                <div className="flex w-full flex-row border-b border-dashed border-[#CCCCCC] bg-[#2B2B2B] p-2">
                                    <input
                                        type="number"
                                        className="w-full bg-[#2B2B2B]"
                                        step={0.001}
                                        value={inputValue}
                                        onChange={(event) => {
                                            setInputValue(event.target.value);
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="mt-1 flex flex-row justify-between">
                                <div className="text-sm text-gray-400">
                                    Allowance: {tokenInfo ? tokenInfo.allowanceFormatted : "-"} {tokenInfo?.symbol}
                                </div>
                                <div className="text-sm text-gray-400">
                                    Balance: {tokenInfo ? tokenInfo.balanceFormatted : "-"} {tokenInfo?.symbol}
                                </div>
                            </div>
                            <div className="mt-4">
                                <Button
                                    disabled={mint.isLoading}
                                    className="w-full"
                                    onClick={async () => {
                                        if (!tokenInfo) return null;
                                        const amount = ethers.utils.parseUnits(inputValue, tokenInfo.decimals);
                                        await mint.mutateAsync({ token: vault.tokenAddress, data: tokenInfo, amount: amount, amountFormatted: inputValue });
                                        setInputValue("");
                                        setOpen(false);
                                    }}
                                >
                                    {mint.isLoading && "Approving..."}
                                    {isLoading && "Loading..."}
                                    {!mint.isLoading && !isLoading && "Mint"}
                                </Button>
                            </div>
                        </div>
                    )}
                    {receipt && (
                        <div className="m-12 text-center">
                            <div className="mb-4 text-green-500">Mint Success!</div>
                            <a href={getExplorerTxLink(chain.chain, receipt.transactionHash)} target="_blank" rel="noreferrer" className="text-gray-text-center py-4 text-sm leading-6 text-gray-light-10 dark:text-gray-dark-10">
                                <span className="hover:underline">Transaction is submitted</span> &#8599;
                            </a>
                        </div>
                    )}
                </div>
            </Dialog.Content>
        </Dialog.Root>
    );
};

export default MintTokenButton;
