import axios from 'axios';

export const initiateStkPush = async (amount: number, phoneNumber: string, orderId: string) => {
  const response = await axios.post('/api/payments/stk-push', {
    amount,
    phoneNumber,
    orderId
  });
  return response.data;
};
