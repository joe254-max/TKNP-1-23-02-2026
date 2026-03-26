export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  is_available: boolean;
  rating?: number;
  tags?: string[];
  containers?: { name: string; price: number }[];
}

export interface CartItem extends MenuItem {
  quantity: number;
  selectedContainer?: { name: string; price: number };
}

export interface Order {
  id: string;
  user_id: string;
  full_name: string;
  phone_number: string;
  items: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    container?: string;
  }[];
  total_amount: number;
  status: 'PENDING' | 'PAID' | 'PREPARING' | 'READY' | 'COMPLETED';
  payment_status: 'PENDING' | 'SUCCESS' | 'FAILED';
  created_at: string;
  checkout_request_id?: string;
  verification_token?: string;
}

export interface User {
  user_id: string;
  full_name: string;
  phone_number: string;
  role?: 'admin' | 'user';
}
