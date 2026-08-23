"use client";

import { useEffect, useState } from "react";
import { TenancyApi, Tenant } from "../tenancy.api";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input, FormField } from "@/components/ui/input";
import { Plus, ShieldAlert, CheckCircle, XCircle, RefreshCw } from "lucide-react";

export function TenantManager() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  const loadTenants = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await TenancyApi.listTenants();
      setTenants(data);
    } catch (err: any) {
      setError(err.message || "Failed to retrieve tenants");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      await TenancyApi.updateTenantStatus(id, newStatus);
      // Reload tenants
      await loadTenants();
    } catch (err: any) {
      alert(err.message || "Failed to update tenant status");
    }
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError(null);
    try {
      await TenancyApi.onboardTenant({
        name,
        branchName,
        ownerName,
        ownerEmail,
        ownerPassword,
      });
      setShowModal(false);
      // Reset form
      setName("");
      setBranchName("");
      setOwnerName("");
      setOwnerEmail("");
      setOwnerPassword("");
      // Reload list
      await loadTenants();
    } catch (err: any) {
      setModalError(err.message || "Failed to onboard new tenant");
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-8 w-40 bg-slate-200 rounded"></div>
          <div className="h-10 w-36 bg-slate-200 rounded"></div>
        </div>
        <div className="h-64 bg-slate-100 rounded-xl border border-slate-200/60"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 max-w-xl mx-auto mt-12 text-center">
        <Alert variant="error">
          <p className="font-semibold">Tenant Load Error</p>
          <p className="text-xs mt-1">{error}</p>
        </Alert>
        <Button onClick={loadTenants} className="w-auto px-6 mx-auto">
          Retry Loading
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tenant Management</h1>
          <p className="text-sm text-slate-500">Configure, onboard, and manage platform tenants.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadTenants} variant="secondary" className="w-auto px-3">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowModal(true)} className="w-auto px-4 gap-1">
            <Plus className="h-4 w-4" /> Onboard Tenant
          </Button>
        </div>
      </div>

      {tenants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center bg-white shadow-sm">
          <ShieldAlert className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-semibold text-slate-900">No tenants onboarded</h3>
          <p className="mt-1 text-sm text-slate-500">Get started by creating the first platform club tenant.</p>
          <div className="mt-6">
            <Button onClick={() => setShowModal(true)} className="w-auto px-4">
              Onboard Tenant
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-700">
              <tr>
                <th className="px-6 py-4">Club Name</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created Date</th>
                <th className="px-6 py-4">Branches</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-900">{t.name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      t.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}>
                      {t.status === "active" ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {t.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2 py-1 rounded">
                      {t.branches.length} Branch(es)
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      onClick={() => handleToggleStatus(t.id, t.status)}
                      variant="secondary"
                      className="w-auto px-3 py-1 text-xs"
                    >
                      {t.status === "active" ? "Suspend" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Onboarding Dialog Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-950">Onboard New Club Tenant</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-medium"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit}>
              <div className="p-6 space-y-4">
                {modalError && (
                  <Alert variant="error">
                    <p className="text-xs">{modalError}</p>
                  </Alert>
                )}

                <FormField label="Club / Tenant Name" htmlFor="name">
                  <Input
                    id="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. CueClub Premium"
                  />
                </FormField>

                <FormField label="First Branch Name" htmlFor="branchName">
                  <Input
                    id="branchName"
                    required
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="e.g. Main Branch"
                  />
                </FormField>

                <div className="border-t border-slate-100 pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">Owner Account Settings</h4>
                  
                  <div className="space-y-4">
                    <FormField label="Owner Full Name" htmlFor="ownerName">
                      <Input
                        id="ownerName"
                        required
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="e.g. Ali Ahmed"
                      />
                    </FormField>

                    <FormField label="Owner Email" htmlFor="ownerEmail">
                      <Input
                        id="ownerEmail"
                        type="email"
                        required
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                        placeholder="owner@club.com"
                      />
                    </FormField>

                    <FormField label="Owner Password" htmlFor="ownerPassword">
                      <Input
                        id="ownerPassword"
                        type="password"
                        required
                        value={ownerPassword}
                        onChange={(e) => setOwnerPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                      />
                    </FormField>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
                <Button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  variant="secondary" 
                  className="w-auto px-5"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  isLoading={modalLoading}
                  className="w-auto px-5 bg-brand-600 text-white hover:bg-brand-700"
                >
                  Onboard Club
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
