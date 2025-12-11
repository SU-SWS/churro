'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ErrorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [errorType, setErrorType] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    setErrorType(searchParams.get('type') || '');
    setMessage(searchParams.get('message') || 'An error occurred.');
  }, [searchParams]);

  const getErrorTitle = () => {
    switch (errorType) {
      case 'application-access':
        return 'Application Access Denied';
      case 'dashboard-access':
        return 'Dashboard Access Denied';
      default:
        return 'Access Denied';
    }
  };

  const getErrorDescription = () => {
    switch (errorType) {
      case 'application-access':
        return 'You do not have the necessary permissions to view this application. If you believe you should have access, please contact your system administrator.';
      case 'dashboard-access':
        return 'You do not have the necessary permissions to view the dashboard. You may have access to specific applications. If you believe you should have dashboard access, please contact your system administrator.';
      default:
        return 'You do not have permission to access this resource. Please contact your system administrator if you believe this is an error.';
    }
  };

  const handleReturnToDashboard = () => {
    router.push('/');
  };

  const handleSignOut = () => {
    window.location.href = '/api/auth/logout';
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-20 py-30">
      <div className="max-w-md mx-auto text-center">
        <div className="mb-30">
          {/* Error icon */}
          <div className="mx-auto w-20 h-20 bg-cardinal-red rounded-full flex items-center justify-center mb-20">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <h1 className="type-1 text-cardinal-red mb-15">
            {getErrorTitle()}
          </h1>

          <p className="text-black-60 mb-10 leading-relaxed">
            {message}
          </p>

          <p className="text-sm text-black-40 leading-relaxed">
            {getErrorDescription()}
          </p>
        </div>

        <div className="space-y-10">
          {errorType !== 'dashboard-access' && (
            <button
              onClick={handleReturnToDashboard}
              className="w-full bg-digital-blue text-white px-20 py-10 rounded font-semibold hocus:bg-black transition-colors duration-150"
            >
              Return to Dashboard
            </button>
          )}

          <button
            onClick={handleSignOut}
            className="w-full bg-black-20 text-black-80 px-20 py-10 rounded font-semibold hocus:bg-black-40 transition-colors duration-150"
          >
            Sign Out
          </button>
        </div>

        <div className="mt-30 text-xs text-black-40">
          <p>Need help? Contact your system administrator.</p>
        </div>
      </div>
    </div>
  );
}