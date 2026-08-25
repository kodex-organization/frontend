"use client";

import {
  Archive,
  Edit3,
  Eye,
  Megaphone,
  Plus,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import {
  archivePlatformAnnouncement,
  createPlatformAnnouncement,
  listPlatformAnnouncements,
  parseIdentifierList,
  publishPlatformAnnouncement,
  updatePlatformAnnouncement,
  type AnnouncementAudience,
  type AnnouncementInput,
  type AnnouncementStatus,
  type PlatformAnnouncement,
} from "../announcements";
import {
  dateTimeInputToIso,
  formatDateTime,
  toDateTimeInput,
} from "../format";

const tenantRoles = ["OWNER", "MANAGER", "ACCOUNTANT", "CASHIER"];

interface AnnouncementDraft {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  targetTenantIds: string;
  targetRoles: string[];
  startsAt: string;
  expiresAt: string;
}

const emptyDraft: AnnouncementDraft = {
  title: "",
  body: "",
  audience: "all_tenants",
  targetTenantIds: "",
  targetRoles: [],
  startsAt: "",
  expiresAt: "",
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function draftFromAnnouncement(
  announcement: PlatformAnnouncement,
): AnnouncementDraft {
  return {
    title: announcement.title,
    body: announcement.body,
    audience: announcement.audience,
    targetTenantIds: announcement.targetTenants
      .map(({ tenant }) => tenant.id)
      .join(", "),
    targetRoles: announcement.targetRoles,
    startsAt: toDateTimeInput(announcement.startsAt),
    expiresAt: toDateTimeInput(announcement.expiresAt),
  };
}

export function buildAnnouncementInput(draft: AnnouncementDraft): AnnouncementInput {
  return {
    title: draft.title.trim(),
    body: draft.body.trim(),
    audience: draft.audience,
    targetTenantIds:
      draft.audience === "selected_tenants"
        ? parseIdentifierList(draft.targetTenantIds)
        : [],
    targetRoles:
      draft.audience === "selected_roles" ? draft.targetRoles : [],
    startsAt: dateTimeInputToIso(draft.startsAt),
    expiresAt: dateTimeInputToIso(draft.expiresAt),
  };
}

function validateDraft(draft: AnnouncementDraft) {
  if (!draft.title.trim() || !draft.body.trim()) {
    return "Title and message are required.";
  }
  if (
    draft.audience === "selected_tenants" &&
    parseIdentifierList(draft.targetTenantIds).length === 0
  ) {
    return "Add at least one tenant UUID for this audience.";
  }
  if (draft.audience === "selected_roles" && draft.targetRoles.length === 0) {
    return "Select at least one tenant role for this audience.";
  }
  if (
    draft.startsAt &&
    draft.expiresAt &&
    new Date(draft.startsAt) >= new Date(draft.expiresAt)
  ) {
    return "Expiry must be after the start time.";
  }
  return null;
}

function StatusBadge({ status }: { status: AnnouncementStatus }) {
  const styles =
    status === "published"
      ? "bg-emerald-50 text-emerald-700"
      : status === "draft"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-600";
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${styles}`}>
      {status}
    </span>
  );
}

export function AnnouncementConsole() {
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [statusFilter, setStatusFilter] = useState<AnnouncementStatus | "all">("all");
  const [audienceFilter, setAudienceFilter] = useState<AnnouncementAudience | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AnnouncementDraft>(emptyDraft);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAnnouncements(
        await listPlatformAnnouncements({
          status: statusFilter === "all" ? undefined : statusFilter,
          audience: audienceFilter === "all" ? undefined : audienceFilter,
        }),
      );
    } catch (requestError) {
      setError(errorMessage(requestError, "Could not load announcements."));
    } finally {
      setLoading(false);
    }
  }, [audienceFilter, statusFilter]);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  const resetDraft = () => {
    setEditingId(null);
    setDraft({ ...emptyDraft, targetRoles: [] });
    setPreviewing(false);
    setFeedback(null);
  };

  const editAnnouncement = (announcement: PlatformAnnouncement) => {
    setEditingId(announcement.id);
    setDraft(draftFromAnnouncement(announcement));
    setPreviewing(false);
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateDraft(draft);
    if (validationError) {
      setFeedback(validationError);
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const input = buildAnnouncementInput(draft);
      if (editingId) await updatePlatformAnnouncement(editingId, input);
      else await createPlatformAnnouncement(input);
      resetDraft();
      await loadAnnouncements();
    } catch (requestError) {
      setFeedback(errorMessage(requestError, "Could not save the announcement."));
    } finally {
      setSaving(false);
    }
  };

  const publishAnnouncement = async (announcement: PlatformAnnouncement) => {
    if (!window.confirm(`Publish "${announcement.title}" to its configured audience?`)) return;
    setError(null);
    try {
      await publishPlatformAnnouncement(announcement.id);
      await loadAnnouncements();
    } catch (requestError) {
      setError(errorMessage(requestError, "Could not publish the announcement."));
    }
  };

  const archiveAnnouncement = async (announcement: PlatformAnnouncement) => {
    if (!window.confirm(`Archive "${announcement.title}"?`)) return;
    setError(null);
    try {
      await archivePlatformAnnouncement(announcement.id);
      if (editingId === announcement.id) resetDraft();
      await loadAnnouncements();
    } catch (requestError) {
      setError(errorMessage(requestError, "Could not archive the announcement."));
    }
  };

  const toggleRole = (role: string) => {
    setDraft((current) => ({
      ...current,
      targetRoles: current.targetRoles.includes(role)
        ? current.targetRoles.filter((item) => item !== role)
        : [...current.targetRoles, role],
    }));
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium text-brand-700">Tenant communication</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">System announcements</h1>
        <p className="mt-2 text-sm text-slate-600">
          Draft, preview, schedule, and publish messages to matching tenant users.
        </p>
      </header>

      <section className="grid gap-7 border-t border-slate-200 pt-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <form onSubmit={saveAnnouncement} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              {editingId ? "Edit announcement" : "New announcement"}
            </h2>
            {editingId ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetDraft}>
                <X className="h-4 w-4" /> Cancel
              </Button>
            ) : null}
          </div>
          {feedback ? <Alert variant="error">{feedback}</Alert> : null}
          <FormField label="Title" htmlFor="announcement-title">
            <Input
              id="announcement-title"
              maxLength={200}
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
            />
          </FormField>
          <FormField label="Message" htmlFor="announcement-body">
            <textarea
              id="announcement-body"
              rows={6}
              maxLength={20_000}
              value={draft.body}
              onChange={(event) =>
                setDraft((current) => ({ ...current, body: event.target.value }))
              }
              className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            />
          </FormField>
          <FormField label="Audience" htmlFor="announcement-audience">
            <Select
              id="announcement-audience"
              value={draft.audience}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  audience: event.target.value as AnnouncementAudience,
                }))
              }
            >
              <option value="all_tenants">All tenants</option>
              <option value="selected_tenants">Selected tenants</option>
              <option value="selected_roles">Selected roles</option>
            </Select>
          </FormField>
          {draft.audience === "selected_tenants" ? (
            <FormField label="Tenant UUIDs" htmlFor="announcement-tenants">
              <textarea
                id="announcement-tenants"
                rows={3}
                value={draft.targetTenantIds}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    targetTenantIds: event.target.value,
                  }))
                }
                placeholder="Comma or line separated UUIDs"
                className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
              />
            </FormField>
          ) : null}
          {draft.audience === "selected_roles" ? (
            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Tenant roles</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {tenantRoles.map((role) => (
                  <label key={role} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.targetRoles.includes(role)}
                      onChange={() => toggleRole(role)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600"
                    />
                    {role}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Starts at" htmlFor="announcement-start">
              <Input
                id="announcement-start"
                type="datetime-local"
                value={draft.startsAt}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, startsAt: event.target.value }))
                }
              />
            </FormField>
            <FormField label="Expires at" htmlFor="announcement-expiry">
              <Input
                id="announcement-expiry"
                type="datetime-local"
                value={draft.expiresAt}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, expiresAt: event.target.value }))
                }
              />
            </FormField>
          </div>
          <div className="flex gap-2">
            <Button type="submit" isLoading={saving} className="flex-1">
              {editingId ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? "Save changes" : "Create draft"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Preview announcement"
              aria-label="Preview announcement"
              onClick={() => setPreviewing((current) => !current)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
          {previewing ? (
            <div className="rounded-md border border-brand-100 bg-brand-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                {draft.title || "Announcement title"}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {draft.body || "Announcement message preview."}
              </p>
            </div>
          ) : null}
        </form>

        <div className="border-l border-slate-200 pl-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Announcement history</h2>
              <p className="mt-1 text-sm text-slate-500">Filter by lifecycle or audience.</p>
            </div>
            <div className="flex gap-2">
              <Select
                aria-label="Filter announcements by status"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as AnnouncementStatus | "all")
                }
                className="w-32"
              >
                <option value="all">All status</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
              <Select
                aria-label="Filter announcements by audience"
                value={audienceFilter}
                onChange={(event) =>
                  setAudienceFilter(event.target.value as AnnouncementAudience | "all")
                }
                className="w-40"
              >
                <option value="all">All audience</option>
                <option value="all_tenants">All tenants</option>
                <option value="selected_tenants">Selected tenants</option>
                <option value="selected_roles">Selected roles</option>
              </Select>
            </div>
          </div>
          {error ? (
            <div className="mt-4 flex items-center gap-3">
              <Alert variant="error">{error}</Alert>
              <Button variant="outline" size="icon" title="Retry" aria-label="Retry" onClick={() => void loadAnnouncements()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">Loading announcements...</p>
            ) : announcements.length === 0 ? (
              <div className="border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                No announcements match these filters.
              </div>
            ) : (
              announcements.map((announcement) => (
                <article key={announcement.id} className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Megaphone className="h-4 w-4 text-slate-400" />
                        <h3 className="font-semibold text-slate-900">{announcement.title}</h3>
                        <StatusBadge status={announcement.status} />
                      </div>
                      <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-slate-600">
                        {announcement.body}
                      </p>
                      <p className="mt-3 text-xs text-slate-500">
                        {announcement.audience.replaceAll("_", " ")} | starts {formatDateTime(announcement.startsAt)} | expires {formatDateTime(announcement.expiresAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {announcement.status !== "archived" ? (
                        <Button type="button" size="icon" variant="ghost" title="Edit" aria-label={`Edit ${announcement.title}`} onClick={() => editAnnouncement(announcement)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {announcement.status === "draft" ? (
                        <Button type="button" size="icon" variant="ghost" title="Publish" aria-label={`Publish ${announcement.title}`} onClick={() => void publishAnnouncement(announcement)}>
                          <Send className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {announcement.status !== "archived" ? (
                        <Button type="button" size="icon" variant="ghost" title="Archive" aria-label={`Archive ${announcement.title}`} onClick={() => void archiveAnnouncement(announcement)}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
