'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import DashboardContent from './DashboardContent'

export default function DashboardPage() {
  const supabase = createClientComponentClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/?redirect=dashboard')
        return
      }
      // ユーザーIDが 0526T で始まるか確認
      const userId: string = session.user.user_metadata?.user_id ?? session.user.email ?? ''
      if (userId.startsWith('0526T')) {
        setAuthorized(true)
      } else {
        setAuthorized(false)
      }
      setLoading(false)
    }
    check()
  }, [supabase, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-600">このページは 0526T のメンバー専用です。</p>
        <button
          onClick={() => router.push('/')}
          className="text-sm text-blue-600 underline"
        >
          トップへ戻る
        </button>
      </div>
    )
  }

  return <DashboardContent />
}
