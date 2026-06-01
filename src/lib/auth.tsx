import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "super_admin" | "admin" | "staff";

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_id: string | null;
  auto_approve_transfers: boolean;
  is_active: boolean;
  must_change_password: boolean;
}

export interface Company {
  id: string;
  name: string;
  type: string;
}

interface AuthState {
  loading: boolean;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  companies: Company[]; // all visible to current user (1 or all 4)
  activeCompanyId: string | null; // super-admin can switch; null = all
  setActiveCompanyId: (id: string | null) => void;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, _setActiveCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setActiveCompanyId = (id: string | null) => {
    _setActiveCompanyId(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem("neela-active-company", id);
      else localStorage.removeItem("neela-active-company");
    }
  };

  const loadProfile = async (uid: string) => {
    const [{ data: prof }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);

    // Deactivated accounts cannot use the app
    if (prof && (prof as Profile).is_active === false) {
      await supabase.auth.signOut();
      const { toast } = await import("sonner");
      toast.error("Account deactivated. Contact your admin.");
      setProfile(null);
      setRole(null);
      setCompanies([]);
      _setActiveCompanyId(null);
      return;
    }

    const userRole: AppRole | null = roles && roles.length > 0
      ? (roles.find((r) => r.role === "super_admin")?.role
        ?? roles.find((r) => r.role === "admin")?.role
        ?? roles[0]?.role ?? null) as AppRole | null
      : null;
    setProfile(prof as Profile | null);
    setRole(userRole);

    // companies — RLS filters automatically
    const { data: comps } = await supabase.from("companies").select("id,name,type").order("name");
    const list = (comps ?? []) as Company[];
    setCompanies(list);

    if (userRole === "super_admin") {
      const stored = typeof window !== "undefined" ? localStorage.getItem("neela-active-company") : null;
      _setActiveCompanyId(stored);
    } else {
      _setActiveCompanyId(prof?.company_id ?? null);
    }
  };


  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => { loadProfile(sess.user.id); }, 0);
      } else {
        setProfile(null);
        setRole(null);
        setCompanies([]);
        _setActiveCompanyId(null);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  const refreshProfile = async () => { if (user) await loadProfile(user.id); };

  return (
    <AuthContext.Provider value={{ loading, user, session, profile, role, companies, activeCompanyId, setActiveCompanyId, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
