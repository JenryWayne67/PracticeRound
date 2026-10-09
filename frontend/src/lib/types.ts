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

export interface Note {
  id: number
  title: string
  body: string
  category: string
  place: string
  author_id: number
  author_name: string
  created_at: string
}

export interface Item {
  id: number
  title: string
  description: string
  done: boolean
  created_at: string
}
