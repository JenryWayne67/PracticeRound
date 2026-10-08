// Mirror of the response schemas in backend/app/models.py.

export interface User {
  id: number
  email: string
  name: string
}

export interface AuthResponse {
  access_token: string
  user: User
}

export interface Item {
  id: number
  title: string
  description: string
  done: boolean
  created_at: string
}
