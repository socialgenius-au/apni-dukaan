import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const api = axios.create({ baseURL: API_URL })

export const getMerchants = (category?: string, search?: string) =>
  api.get('/merchants/', { params: { category, search } }).then(r => r.data)

export const getMerchant = (id: number) =>
  api.get(`/merchants/${id}`).then(r => r.data)

export const getMerchantProducts = (id: number) =>
  api.get(`/merchants/${id}/products`).then(r => r.data)

export const getHappyHours = () =>
  api.get('/happyhours/').then(r => r.data)

export const createOrder = (order: any) =>
  api.post('/orders/', order).then(r => r.data)

export const createCheckout = (data: any) =>
  api.post('/payments/create-checkout', data).then(r => r.data)

export const getSession = (sessionId: string) =>
  api.get(`/payments/session/${sessionId}`).then(r => r.data)

export const getArticles = () =>
  api.get('/articles/').then(r => r.data)

export default api

export const validatePromo = (code: string) =>
  api.get('/promo/validate', { params: { code } }).then(r => r.data)
