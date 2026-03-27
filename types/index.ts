export type UserRole = 'user' | 'creator' | 'admin'

export interface Profile {
  id: string
  email: string
  username: string
  display_name: string
  avatar_url?: string
  role: UserRole
  bio?: string
  twitter_url?: string
  instagram_url?: string
  tiktok_url?: string
  created_at: string
}

export interface Content {
  id: string
  creator_id: string
  title: string
  description?: string
  price: number
  content_type: 'image' | 'video'
  thumbnail_url?: string
  file_url: string
  stock_limit?: number       // null = 無制限
  sold_count: number
  is_published: boolean
  created_at: string
  creator?: Profile
}

export interface Purchase {
  id: string
  user_id: string
  content_id: string
  amount: number
  stripe_payment_intent_id: string
  status: 'pending' | 'completed' | 'failed'
  created_at: string
  content?: Content
}
