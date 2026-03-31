export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stockStatus: 'low' | 'medium' | 'high';
  stockCount: number;
  dlc: string; // Date Limite de Consommation
  manufacturer: string;
  image: string;
  isReimbursed: boolean;
  description?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface Order {
  id: string;
  status: 'received' | 'preparing' | 'on_way' | 'delivered';
  eta: number; // minutes
  items: { product: Product; quantity: number }[];
  totalPrice: number;
  reimbursedAmount: number;
  patientAmount: number;
  deliveryType: 'express' | 'scheduled' | 'night';
  deliverySlot?: string;
  courierName?: string;
  date: string;
}
