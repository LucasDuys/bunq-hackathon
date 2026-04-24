import { callBunq } from "./client";

export const createSubAccount = async (userId: string, token: string, description: string) => {
  return callBunq<{ Response: Array<{ Id: { id: number } }> }>({
    method: "POST",
    path: `/v1/user/${userId}/monetary-account-bank`,
    body: { currency: "EUR", description },
    token,
  });
};

export const getBalance = async (userId: string, accountId: string, token: string) => {
  return callBunq<{ Response: Array<{ MonetaryAccountBank: { balance: { value: string; currency: string } } }> }>({
    method: "GET",
    path: `/v1/user/${userId}/monetary-account-bank/${accountId}`,
    token,
  });
};
