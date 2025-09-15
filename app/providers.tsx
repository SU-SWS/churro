'use client'
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { ReactNode } from 'react'

interface ProvidersProps {
  children: ReactNode
}

export function SessionProvider({ children }: ProvidersProps) {
  return (
    <NextAuthSessionProvider>
      {children}
    </NextAuthSessionProvider>
  )
}
