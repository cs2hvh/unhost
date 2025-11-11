"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Save, X, Edit2, Cpu } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CPUType {
  id: string
  plan_category: string
  cpu_name: string
  cpu_description?: string | null
  created_at: string
  updated_at: string
}

interface CPUTypesSectionProps {
  getAccessToken: () => Promise<string | null>
}

export default function CPUTypesSection({ getAccessToken }: CPUTypesSectionProps) {
  const [cpuTypes, setCPUTypes] = useState<CPUType[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    cpu_name: "",
    cpu_description: "",
  })
  const [saving, setSaving] = useState(false)

  // Fetch CPU types
  const fetchCPUTypes = async () => {
    try {
      const token = await getAccessToken()
      if (!token) {
        toast.error("Not authorized")
        return
      }

      const response = await fetch("/api/admin/cpu-types", {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()

      if (data.ok) {
        setCPUTypes(data.cpuTypes || [])
      } else {
        toast.error(data.error || "Failed to load CPU types")
      }
    } catch (error) {
      console.error("Error fetching CPU types:", error)
      toast.error("Failed to load CPU types")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCPUTypes()
  }, [])

  // Start editing
  const startEdit = (cpuType: CPUType) => {
    setEditingId(cpuType.id)
    setEditForm({
      cpu_name: cpuType.cpu_name,
      cpu_description: cpuType.cpu_description || "",
    })
  }

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({ cpu_name: "", cpu_description: "" })
  }

  // Save CPU type
  const saveCPUType = async (planCategory: string) => {
    if (!editForm.cpu_name.trim()) {
      toast.error("CPU name is required")
      return
    }

    setSaving(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        toast.error("Not authorized")
        return
      }

      const response = await fetch("/api/admin/cpu-types", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          plan_category: planCategory,
          cpu_name: editForm.cpu_name.trim(),
          cpu_description: editForm.cpu_description.trim() || null,
        }),
      })

      const data = await response.json()

      if (data.ok) {
        toast.success("CPU type updated successfully")
        await fetchCPUTypes()
        cancelEdit()
      } else {
        toast.error(data.error || "Failed to update CPU type")
      }
    } catch (error) {
      console.error("Error saving CPU type:", error)
      toast.error("Failed to save CPU type")
    } finally {
      setSaving(false)
    }
  }

  // Get category label
  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      shared: "Shared CPU",
      dedicated: "Dedicated CPU",
      highmem: "High Memory",
      premium: "Premium CPU",
      storage: "Storage Optimized",
    }
    return labels[category] || category
  }

  // Get category badge color
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      shared: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      dedicated: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      highmem: "bg-orange-500/10 text-orange-400 border-orange-500/20",
      premium: "bg-green-500/10 text-green-400 border-green-500/20",
      storage: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    }
    return colors[category] || "bg-gray-500/10 text-gray-400 border-gray-500/20"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
          <Cpu className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">CPU Types</h2>
          <p className="text-white/60 text-sm">
            Manage processor names for different plan categories
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {cpuTypes.map((cpuType) => {
          const isEditing = editingId === cpuType.id

          return (
            <div
              key={cpuType.id}
              className="rounded-xl border border-white/10 bg-white/5 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className={`px-3 py-1 rounded-lg border text-xs font-medium ${getCategoryColor(
                        cpuType.plan_category
                      )}`}
                    >
                      {getCategoryLabel(cpuType.plan_category)}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          CPU Processor Name
                        </label>
                        <input
                          type="text"
                          value={editForm.cpu_name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, cpu_name: e.target.value })
                          }
                          placeholder="e.g., Intel Xeon 2334S"
                          className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                          Description (Optional)
                        </label>
                        <textarea
                          value={editForm.cpu_description}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              cpu_description: e.target.value,
                            })
                          }
                          placeholder="Brief description of this CPU category"
                          rows={2}
                          className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => saveCPUType(cpuType.plan_category)}
                          disabled={saving}
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Save
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={cancelEdit}
                          disabled={saving}
                          variant="outline"
                          className="border-white/10 text-white/80 hover:bg-white/5"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {cpuType.cpu_name}
                      </h3>
                      {cpuType.cpu_description && (
                        <p className="text-white/60 text-sm">
                          {cpuType.cpu_description}
                        </p>
                      )}
                      <p className="text-white/40 text-xs mt-2">
                        Last updated:{" "}
                        {new Date(cpuType.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <Button
                    onClick={() => startEdit(cpuType)}
                    variant="outline"
                    className="border-white/10 text-white/80 hover:bg-white/5"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <p className="text-blue-300 text-sm">
          <strong>Note:</strong> CPU names are displayed to users when creating
          servers. Changes take effect immediately and are grouped by processor
          type in the pricing section.
        </p>
      </div>
    </div>
  )
}
