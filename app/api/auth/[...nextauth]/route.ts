import NextAuth from 'next-auth'

const authOptions = {
  providers: [
    {
      id: "stanford-saml",
      name: "Stanford SAML",
      type: "saml",
      server: {
        entryPoint: process.env.SAML_ENTRY_POINT,
        issuer: process.env.SAML_ISSUER,
        cert: process.env.SAML_CERT || "dummy-cert", // Provide a dummy cert for now
      },
      options: {
        audience: process.env.SAML_AUDIENCE || process.env.NEXTAUTH_URL,
        wantAssertionsSigned: false, // Disable for testing
        wantAuthnResponseSigned: false, // Disable for testing
      },
      profile: (profile: any) => {
        console.log('SAML Profile received:', profile)
        return {
          id: profile.nameID || "test-id",
          email: profile.mail || "test@stanford.edu",
          name: profile.displayName || "Test User",
        }
      },
    }
  ],
  session: {
    strategy: "jwt" as const,
  },
  debug: true,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
export { authOptions }