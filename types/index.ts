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
  fee_rate: number
  bank_name?: string
  bank_branch?: string
  bank_account_type?: 'ordinary' | 'checking'
  bank_account_number?: string
  bank_account_holder?: string
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
  stock_limit?: number
  sold_count: number
  is_published: boolean
  review_status: 'pending' | 'approved' | 'rejected'
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
  delivery_status: 'pending' | 'delivered'
  delivered_file_url?: string
  delivered_at?: string
  created_at: string
  content?: Content
  user?: Profile
}

export interface Payout {
  id: string
  creator_id: string
  amount: number
  fee_amount: number
  net_amount: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  period_start: string
  period_end: string
  paid_at?: string
  note?: string
  created_at: string
  creator?: Profile
}

export interface Inquiry {
  id: string
  user_id?: string
  email: string
  subject: string
  body: string
  status: 'open' | 'in_progress' | 'closed'
  created_at: string
  user?: Profile
}
