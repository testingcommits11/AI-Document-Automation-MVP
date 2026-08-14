"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  createField,
  deleteField,
  updateField,
} from "@/lib/api";

import {
  FieldType,
  IndustryKey,
  IndustryMeta,
} from "@/lib/types";


export default function FieldSettings({
  industries,
  onRefresh,
  onRequireLogin,
  isAuthenticated,
}: {
  industries: Record<
    IndustryKey,
    IndustryMeta
  >;

  onRefresh: () => Promise<void>;

  onRequireLogin: () => void;

  isAuthenticated: boolean;
}) {
  const [industry, setIndustry] =
    useState<IndustryKey>(
      Object.keys(
        industries,
      )[0] as IndustryKey,
    );

  const [label, setLabel] =
    useState("");

  const [type, setType] =
    useState<FieldType>("text");

  const [key, setKey] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);


  useEffect(() => {
    if (!industries[industry]) {
      const first =
        Object.keys(
          industries,
        )[0] as
          | IndustryKey
          | undefined;

      if (first) {
        setIndustry(first);
      }
    }
  }, [
    industries,
    industry,
  ]);


  async function refresh() {
    setMessage(null);
    await onRefresh();
  }


  function requireLogin() {
    setMessage(null);
    onRequireLogin();
  }


  async function handleAdd() {
    if (!isAuthenticated) {
      requireLogin();
      return;
    }

    if (!label.trim()) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await createField(
        industry,
        {
          label:
            label.trim(),
          type,
          key:
            key.trim() ||
            undefined,
        },
      );

      setLabel("");
      setKey("");
      setType("text");

      await refresh();

      setMessage(
        "Custom field added successfully.",
      );
    } catch (error: any) {
      setMessage(
        error?.message ||
          "Could not add field.",
      );
    } finally {
      setBusy(false);
    }
  }


  async function handleUpdate(
    field: any,
  ) {
    if (!isAuthenticated) {
      requireLogin();
      return;
    }

    if (field.is_default) {
      setMessage(
        "Default fields cannot be modified.",
      );
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await updateField(
        industry,
        field.id,
        {
          label:
            field.label,
          type:
            field.type,
        },
      );

      await refresh();

      setMessage(
        "Custom field updated.",
      );
    } catch (error: any) {
      setMessage(
        error?.message ||
          "Could not update field.",
      );
    } finally {
      setBusy(false);
    }
  }


  async function handleDelete(
    field: any,
  ) {
    if (!isAuthenticated) {
      requireLogin();
      return;
    }

    if (field.is_default) {
      setMessage(
        "Default fields cannot be deleted.",
      );
      return;
    }

    if (
      !window.confirm(
        `Delete "${field.label}" from your custom fields?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await deleteField(
        industry,
        field.id,
      );

      await refresh();

      setMessage(
        "Custom field deleted.",
      );
    } catch (error: any) {
      setMessage(
        error?.message ||
          "Could not delete field.",
      );
    } finally {
      setBusy(false);
    }
  }


  const fields =
    industries[industry]?.fields ||
    [];


  return (
    <div className="bg-white rounded-2xl shadow-card border border-line/50 p-6 sm:p-8 animate-fade-in">

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
            Field schema
          </p>

          <h2 className="font-display font-semibold text-2xl text-ink">
            Field Settings
          </h2>

          <p className="text-inksoft text-sm mt-1 max-w-2xl">
            Default fields are shared by everyone.
            Custom fields belong only to your account.
          </p>
        </div>

        <select
          value={industry}
          onChange={(event) =>
            setIndustry(
              event.target.value as IndustryKey,
            )
          }
          className="border border-line rounded-xl px-3 py-2.5 text-sm bg-white"
        >
          {Object.entries(
            industries,
          ).map(
            ([value, meta]) => (
              <option
                key={value}
                value={value}
              >
                {meta.label}
              </option>
            ),
          )}
        </select>
      </div>


      {!isAuthenticated && (
        <div className="mb-6 rounded-xl border border-primary/20 bg-primarysoft px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-ink text-sm">
                Login required for custom fields
              </p>

              <p className="text-inksoft text-xs mt-1">
                All document processing, validation,
                downloading and email features remain available without login.
              </p>
            </div>

            <button
              type="button"
              onClick={requireLogin}
              className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Login / Register
            </button>
          </div>
        </div>
      )}


      {isAuthenticated && (
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_0.8fr_1fr_auto] gap-3 mb-6">

          <input
            value={label}
            onChange={(event) =>
              setLabel(
                event.target.value,
              )
            }
            placeholder="Field label"
            className="border border-line rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />

          <select
            value={type}
            onChange={(event) =>
              setType(
                event.target.value as FieldType,
              )
            }
            className="border border-line rounded-xl px-3 py-2.5 text-sm bg-white"
          >
            <option value="text">
              Text
            </option>
            <option value="date">
              Date
            </option>
            <option value="number">
              Number
            </option>
          </select>

          <input
            value={key}
            onChange={(event) =>
              setKey(
                event.target.value,
              )
            }
            placeholder="Optional key"
            className="border border-line rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />

          <button
            disabled={
              busy ||
              !label.trim()
            }
            onClick={handleAdd}
            className="btn-gradient rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            Add Field
          </button>
        </div>
      )}


      {message && (
        <div className="mb-5 rounded-xl border border-primary/20 bg-primarysoft px-4 py-3 text-sm text-ink">
          {message}
        </div>
      )}


      <div className="space-y-3">
        {fields.map(
          (field: any) => {
            const isDefault =
              Boolean(
                field.is_default,
              );

            return (
              <div
                key={
                  field.id ||
                  field.key
                }
                className="grid grid-cols-1 md:grid-cols-[1fr_180px_140px_auto] gap-3 items-center border border-line rounded-xl p-3"
              >

                <div className="flex items-center gap-2">
                  <input
                    defaultValue={
                      field.label
                    }
                    disabled={
                      isDefault ||
                      !isAuthenticated
                    }
                    onChange={(
                      event,
                    ) => {
                      field.label =
                        event.target.value;
                    }}
                    className="flex-1 border border-line rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-inksoft"
                  />

                  <span
                    className={`text-[10px] font-mono uppercase tracking-wide px-2 py-1 rounded-full ${
                      isDefault
                        ? "bg-slate-100 text-slate-500"
                        : "bg-primarysoft text-primary"
                    }`}
                  >
                    {isDefault
                      ? "Default"
                      : "Mine"}
                  </span>
                </div>


                <select
                  defaultValue={
                    field.type
                  }
                  disabled={
                    isDefault ||
                    !isAuthenticated
                  }
                  onChange={(
                    event,
                  ) => {
                    field.type =
                      event.target.value as FieldType;
                  }}
                  className="border border-line rounded-lg px-3 py-2 text-sm bg-white disabled:bg-slate-50"
                >
                  <option value="text">
                    Text
                  </option>

                  <option value="date">
                    Date
                  </option>

                  <option value="number">
                    Number
                  </option>
                </select>


                <span className="font-mono text-xs text-inksoft truncate">
                  {field.key}
                </span>


                <div className="flex gap-2 justify-end">
                  {isDefault ? (
                    <span className="text-xs text-slate-400">
                      Locked
                    </span>
                  ) : (
                    <>
                      <button
                        disabled={
                          busy ||
                          !isAuthenticated
                        }
                        onClick={() =>
                          handleUpdate(
                            field,
                          )
                        }
                        className="border border-line rounded-lg px-3 py-2 text-xs font-semibold hover:border-primary hover:text-primary disabled:opacity-50"
                      >
                        Save
                      </button>

                      <button
                        disabled={
                          busy ||
                          !isAuthenticated
                        }
                        onClick={() =>
                          handleDelete(
                            field,
                          )
                        }
                        className="border border-red-200 text-red-600 rounded-lg px-3 py-2 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}