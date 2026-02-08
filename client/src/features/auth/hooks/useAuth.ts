import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import type { AuthContextType } from '../context/AuthContext';

/**
 * Custom hook to access authentication context
 * 
 * @returns Authentication context with state and actions
 * @throws Error if used outside of AuthProvider
 * 
 * @example
 * ```tsx
 * function LoginPage() {
 *   const { login, isLoading, error } = useAuth();
 *   
 *   const handleSubmit = async (data) => {
 *     try {
 *       await login(data);
 *     } catch (err) {
 *       // Handle error
 *     }
 *   };
 *   
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
