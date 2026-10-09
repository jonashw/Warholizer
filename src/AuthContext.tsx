// This module intentionally exports a { Provider, useAuth } object; fast refresh falls back to a full reload here.
/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useContext } from 'react';
import { ReactNode } from 'react';
import { User } from '../api/auth.mts';

const storageKey = 'google_auth_state';

type AuthProvider = {
    state: AuthState | null
    authenticatedFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
    login: (token: string, user: User) => void,
    logout: () => void,
}

/** Google ID tokens last an hour; an expired one would only earn 401s. */
const tokenExpired = (token: string): boolean => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now() + 60_000;
    } catch {
        return true;
    }
};

const tryGetStoredState = (): AuthState|null => {
    const stored = localStorage.getItem(storageKey);
    if(!stored) {
        return null;
    }
    try {
        const state = JSON.parse(stored) as AuthState;
        if(!state.token || !state.user || typeof state.user !== 'object' || tokenExpired(state.token)) {
            console.warn('Invalid stored auth found. Removing...', state);
            localStorage.removeItem(storageKey);
            return null;
        }
        return state;
    } catch(e) {
        console.error('Failed to parse stored auth state', e);
        return null;
    }
}

type AuthState = {
  token: string,
  user: User
};

const nullProvider: AuthProvider = {
    state: null,
    authenticatedFetch: (input: RequestInfo, init?: RequestInit) => fetch(input, init),
    login: (_: string, __: User) => {},
    logout: () => {},
}

const AuthContext = createContext(nullProvider);

type AuthProviderProps = {
  children: ReactNode;
};

const Provider = ({ children }: AuthProviderProps) => {
  const [state, setState] = useState<AuthState|null>(tryGetStoredState());

  const login = (token: string, user: User) => {
    localStorage.setItem(storageKey, JSON.stringify({token,user}));
    setState({token,user});
  };

  const logout = () => {
    localStorage.removeItem(storageKey);
    setState(null);
  };

  const authenticatedFetch = (input: RequestInfo, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});
    if (state) {
      headers.set('Authorization', `Bearer ${state.token}`);
    }
    const modifiedInit = { ...init, headers };
    return fetch(input, modifiedInit);
  };

  return (
    <AuthContext.Provider value={{ state, login, logout, authenticatedFetch}}>
      {children}
    </AuthContext.Provider>
  );
};

export default {
  Provider,
  useAuth: () => useContext(AuthContext)
};