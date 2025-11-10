import React, { useState, useEffect } from 'react';
import { FaSave, FaCheck, FaTimes, FaSync } from 'react-icons/fa';
import { Loader } from '@/components/ui/loader';
import { InlineLoader } from '@/components/ui/loader';
import toast from 'react-hot-toast';
import { LINODE_PLAN_TYPES } from '@/lib/linode';
import { clearPricingCache } from '@/lib/pricingDb';

interface PricingEntry {
  id: string;
  plan_id: string;
  hourly_price: number;
  monthly_price: number;
  is_active: boolean;
}

interface PlanDisplay {
  plan_id: string;
  label: string;
  specs: string;
  category: string;
  linode_hourly: number;
  linode_monthly: number;
  custom_hourly?: number;
  custom_monthly?: number;
  pricing_id?: string;
  is_active: boolean;
}

interface PricingSectionProps {
  getAccessToken: () => Promise<string | null>;
}

export function PricingSection({ getAccessToken }: PricingSectionProps) {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PlanDisplay[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ hourly: string; monthly: string }>({ hourly: '', monthly: '' });
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    loadPlansWithPricing();
  }, []);

  const loadPlansWithPricing = async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        toast.error('Not authorized');
        return;
      }

      // Fetch custom pricing from database
      const response = await fetch('/api/admin/pricing', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      const customPricing = data.ok ? data.pricing : [];
      
      // Build pricing map
      const pricingMap = new Map<string, PricingEntry>();
      customPricing.forEach((p: PricingEntry) => {
        pricingMap.set(p.plan_id, p);
      });

      // Combine Linode plans with custom pricing
      const allPlans: PlanDisplay[] = Object.entries(LINODE_PLAN_TYPES).map(([id, plan]) => {
        const custom = pricingMap.get(id);
        return {
          plan_id: id,
          label: plan.label,
          specs: `${plan.vcpus} vCPU, ${plan.memory / 1024}GB RAM, ${plan.disk / 1024}GB SSD`,
          category: plan.category,
          linode_hourly: plan.hourly,
          linode_monthly: plan.monthly,
          custom_hourly: custom?.hourly_price,
          custom_monthly: custom?.monthly_price,
          pricing_id: custom?.id,
          is_active: custom?.is_active ?? true
        };
      });

      setPlans(allPlans);
    } catch (error) {
      console.error('Error loading plans:', error);
      toast.error('Failed to load pricing');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (plan: PlanDisplay) => {
    setEditingId(plan.plan_id);
    setEditValues({
      hourly: (plan.custom_hourly ?? plan.linode_hourly).toString(),
      monthly: (plan.custom_monthly ?? plan.linode_monthly).toString()
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({ hourly: '', monthly: '' });
  };

  const saveEdit = async (plan: PlanDisplay) => {
    setSavingId(plan.plan_id);
    try {
      const hourly = parseFloat(editValues.hourly);
      const monthly = parseFloat(editValues.monthly);

      if (isNaN(hourly) || isNaN(monthly)) {
        toast.error('Invalid price values');
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        toast.error('Not authorized');
        return;
      }

      // If pricing exists, update it; otherwise create new
      if (plan.pricing_id) {
        const response = await fetch('/api/admin/pricing', {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            id: plan.pricing_id,
            hourly_price: hourly,
            monthly_price: monthly
          })
        });
        const data = await response.json();
        if (data.ok) {
          toast.success('Pricing updated');
          clearPricingCache(); // Clear cache so new prices load immediately
          await loadPlansWithPricing();
          setEditingId(null);
        } else {
          toast.error('Failed to update pricing');
        }
      } else {
        // Create new pricing entry
        const response = await fetch('/api/admin/pricing', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            plan_id: plan.plan_id,
            plan_category: plan.category,
            plan_name: plan.label,
            hourly_price: hourly,
            monthly_price: monthly
          })
        });
        const data = await response.json();
        if (data.ok) {
          toast.success('Custom pricing created');
          clearPricingCache(); // Clear cache so new prices load immediately
          await loadPlansWithPricing();
          setEditingId(null);
        } else {
          toast.error('Failed to create pricing');
        }
      }
    } catch (error) {
      console.error('Error saving pricing:', error);
      toast.error('Failed to save pricing');
    } finally {
      setSavingId(null);
    }
  };

  const resetToDefault = async (plan: PlanDisplay) => {
    if (!plan.pricing_id) return;

    try {
      const token = await getAccessToken();
      if (!token) {
        toast.error('Not authorized');
        return;
      }

      const response = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: plan.pricing_id,
          hourly_price: plan.linode_hourly,
          monthly_price: plan.linode_monthly
        })
      });
      const data = await response.json();
      if (data.ok) {
        toast.success('Reset to Linode pricing');
        clearPricingCache(); // Clear cache so new prices load immediately
        await loadPlansWithPricing();
      } else {
        toast.error('Failed to reset pricing');
      }
    } catch (error) {
      console.error('Error resetting pricing:', error);
      toast.error('Failed to reset pricing');
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      shared: 'Shared CPU',
      dedicated: 'Dedicated CPU',
      highmem: 'High Memory',
      high_memory: 'High Memory',
      premium: 'Premium CPU',
      gpu: 'GPU'
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      shared: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      dedicated: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      highmem: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      high_memory: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      premium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      gpu: 'bg-green-500/20 text-green-300 border-green-500/30'
    };
    return colors[category] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader /></div>;
  }

  // Group plans by category
  const groupedPlans = plans.reduce((acc, plan) => {
    if (!acc[plan.category]) acc[plan.category] = [];
    acc[plan.category].push(plan);
    return acc;
  }, {} as Record<string, PlanDisplay[]>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Server Pricing Management</h2>
          <p className="text-white/60 mt-1">Edit pricing for Linode server plans. Changes apply immediately to new servers.</p>
        </div>
        <button
          onClick={loadPlansWithPricing}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-lg transition-colors flex items-center gap-2"
        >
          <FaSync className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedPlans).map(([category, categoryPlans]) => (
          <div key={category}>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className={`px-3 py-1 rounded text-sm font-medium border ${getCategoryColor(category)}`}>
                {getCategoryLabel(category)}
              </span>
              <span className="text-white/40 text-sm">({categoryPlans.length} plans)</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-3 text-white/70 text-sm font-medium">Plan ID</th>
                    <th className="text-left p-3 text-white/70 text-sm font-medium">Specs</th>
                    <th className="text-right p-3 text-white/70 text-sm font-medium">Linode Price</th>
                    <th className="text-right p-3 text-white/70 text-sm font-medium">Your Hourly Price</th>
                    <th className="text-right p-3 text-white/70 text-sm font-medium">Your Monthly Price</th>
                    <th className="text-center p-3 text-white/70 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryPlans.map(plan => {
                    const hasCustomPricing = plan.custom_hourly !== undefined;
                    const isEditing = editingId === plan.plan_id;
                    const isSaving = savingId === plan.plan_id;

                    return (
                      <tr key={plan.plan_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="p-3">
                          <div>
                            <div className="text-white font-mono text-sm">{plan.plan_id}</div>
                            <div className="text-white/60 text-xs">{plan.label}</div>
                          </div>
                        </td>
                        <td className="p-3 text-white/80 text-sm">{plan.specs}</td>
                        <td className="p-3 text-right">
                          <div className="text-white/60 text-xs">${plan.linode_hourly.toFixed(4)}/hr</div>
                          <div className="text-white/60 text-xs">${plan.linode_monthly.toFixed(2)}/mo</div>
                        </td>
                        <td className="p-3 text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.0001"
                              value={editValues.hourly}
                              onChange={(e) => setEditValues({ ...editValues, hourly: e.target.value })}
                              className="w-28 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-right text-sm"
                              placeholder="0.0000"
                            />
                          ) : (
                            <div className={hasCustomPricing ? 'text-green-400 font-medium' : 'text-white/80'}>
                              ${(plan.custom_hourly ?? plan.linode_hourly).toFixed(4)}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editValues.monthly}
                              onChange={(e) => setEditValues({ ...editValues, monthly: e.target.value })}
                              className="w-28 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-right text-sm"
                              placeholder="0.00"
                            />
                          ) : (
                            <div className={hasCustomPricing ? 'text-green-400 font-medium' : 'text-white/80'}>
                              ${(plan.custom_monthly ?? plan.linode_monthly).toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => saveEdit(plan)}
                                  disabled={isSaving}
                                  className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 rounded transition-colors"
                                  title="Save"
                                >
                                  {isSaving ? <InlineLoader /> : <FaCheck className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="p-2 bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 rounded transition-colors"
                                  title="Cancel"
                                >
                                  <FaTimes className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(plan)}
                                  className="p-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded transition-colors"
                                  title="Edit Pricing"
                                >
                                  <FaSave className="w-4 h-4" />
                                </button>
                                {hasCustomPricing && (
                                  <button
                                    onClick={() => resetToDefault(plan)}
                                    className="p-2 bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 rounded transition-colors text-xs px-2"
                                    title="Reset to Linode Default"
                                  >
                                    Reset
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12">
          <p className="text-white/40">No plans found</p>
        </div>
      )}

      <div className="mt-6 p-4 bg-white/5 border border-white/10 rounded-lg">
        <div className="text-sm text-white/70">
          <strong className="text-white">Note:</strong> Plans show Linode's default pricing. 
          Click edit to set custom pricing. Custom prices are highlighted in <span className="text-green-400">green</span>.
          Click "Reset" to revert to Linode defaults.
        </div>
      </div>
    </div>
  );
}
