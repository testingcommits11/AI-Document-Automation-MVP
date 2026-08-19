"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Stepper from "@/components/Stepper";
import IndustrySelect from "@/components/IndustrySelect";
import UploadStep from "@/components/UploadStep";
import ProcessStep from "@/components/ProcessStep";
import ResultsStep from "@/components/ResultsStep";
import SessionList from "@/components/SessionList";
import DataValidationFlow from "@/components/DataValidationFlow";
import FieldSettings from "@/components/FieldSettings";
import LoginModal from "@/components/LoginModal";

import {
  fetchCurrentUser,
  fetchDemoPdf,
  fetchDocuments,
  fetchIndustries,
  logout,
  processDocument,
  updateProcessedDocument,
} from "@/lib/api";

import {
  IndustryKey,
  IndustryMeta,
  ProcessResult,
  SessionRecord,
} from "@/lib/types";


type AuthUser = {
  id: number;
  email: string;
};


type ProcessResultWithDocument =
  ProcessResult & {
    document_id?: number;
    field_schema?: any[];
  };


export default function Home() {
  // ==========================================================================
  // AUTH
  // ==========================================================================

  const [
    authChecking,
    setAuthChecking,
  ] = useState(true);

  const [
    user,
    setUser,
  ] = useState<AuthUser | null>(
    null,
  );

  const [
    showLogin,
    setShowLogin,
  ] = useState(false);


  // ==========================================================================
  // APP
  // ==========================================================================

  const [
    industries,
    setIndustries,
  ] = useState<
    Record<
      IndustryKey,
      IndustryMeta
    > | null
  >(null);

  const [
    loadError,
    setLoadError,
  ] = useState<string | null>(
    null,
  );

  const [
    activeTab,
    setActiveTab,
  ] = useState<
    "process" | "validate" | "fields"
  >("process");


  // ==========================================================================
  // PROCESS
  // ==========================================================================

  const [
    screen,
    setScreen,
  ] = useState(1);

  const [
    industry,
    setIndustry,
  ] = useState<
    IndustryKey | null
  >(null);

  const [
    pdfBlob,
    setPdfBlob,
  ] = useState<Blob | null>(
    null,
  );

  const [
    pdfUrl,
    setPdfUrl,
  ] = useState("");

  const [
    sourceLabel,
    setSourceLabel,
  ] = useState("");

  const [
    uploadError,
    setUploadError,
  ] = useState<string | null>(
    null,
  );

  const [
    processing,
    setProcessing,
  ] = useState(false);

  const [
    processError,
    setProcessError,
  ] = useState<string | null>(
    null,
  );

  const [
    result,
    setResult,
  ] = useState<
    ProcessResult | null
  >(null);


  // ==========================================================================
  // SAVED DOCUMENTS
  // ==========================================================================

  const [
    sessionResults,
    setSessionResults,
  ] = useState<
    SessionRecord[]
  >([]);


  // ==========================================================================
  // LOAD APPLICATION DATA
  // ==========================================================================

  const loadAppData =
    useCallback(async () => {
      const [
        nextIndustries,
        documents,
      ] = await Promise.all([
        fetchIndustries(),
        fetchDocuments(),
      ]);

      setIndustries(
        nextIndustries,
      );

      setSessionResults(
        documents,
      );
    }, []);


  // ==========================================================================
  // REFRESH USER
  // ==========================================================================

  const refreshUser =
    useCallback(async () => {
      const data =
        await fetchCurrentUser();

      const currentUser =
        data?.user || null;

      setUser(
        currentUser,
      );

      return currentUser;
    }, []);


  // ==========================================================================
  // INITIAL AUTH CHECK
  // ==========================================================================

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const data =
          await fetchCurrentUser();

        if (!mounted) {
          return;
        }

        const currentUser =
          data?.user || null;

        setUser(
          currentUser,
        );

        if (!currentUser) {
          setShowLogin(true);
          return;
        }

        await loadAppData();
      } catch (error: any) {
        if (!mounted) {
          return;
        }

        setLoadError(
          error?.message ||
            "Could not load the application.",
        );
      } finally {
        if (mounted) {
          setAuthChecking(
            false,
          );
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, [loadAppData]);


  // ==========================================================================
  // SESSION EXPIRED
  // ==========================================================================

  const handleSessionExpired =
    useCallback(() => {
      logout();

      setUser(null);
      setIndustries(null);
      setSessionResults([]);
      setResult(null);

      setPdfBlob(null);
      setPdfUrl("");
      setSourceLabel("");

      setUploadError(null);
      setProcessError(null);
      setProcessing(false);

      setActiveTab(
        "process",
      );

      setScreen(1);

      setShowLogin(true);
    }, []);


  // ==========================================================================
  // SESSION CHECK
  // ==========================================================================

  const checkAuthentication =
    useCallback(async () => {
      if (!user) {
        return;
      }

      try {
        const currentUser =
          await refreshUser();

        if (!currentUser) {
          handleSessionExpired();
        }
      } catch {
        handleSessionExpired();
      }
    }, [
      user,
      refreshUser,
      handleSessionExpired,
    ]);


  // ==========================================================================
  // PERIODIC SESSION CHECK
  // ==========================================================================

  useEffect(() => {
    if (!user) {
      return;
    }

    // Immediate check.
    checkAuthentication();

    // Check every 30 seconds.
    const timer =
      window.setInterval(
        () => {
          checkAuthentication();
        },
        30_000,
      );

    return () =>
      window.clearInterval(
        timer,
      );
  }, [
    user,
    checkAuthentication,
  ]);


  // ==========================================================================
  // CHECK WHEN TAB/APP GETS FOCUS
  // ==========================================================================

  useEffect(() => {
    if (!user) {
      return;
    }

    const handleVisibility =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          checkAuthentication();
        }
      };

    const handleFocus =
      () => {
        checkAuthentication();
      };

    document.addEventListener(
      "visibilitychange",
      handleVisibility,
    );

    window.addEventListener(
      "focus",
      handleFocus,
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
      );

      window.removeEventListener(
        "focus",
        handleFocus,
      );
    };
  }, [
    user,
    checkAuthentication,
  ]);


  // ==========================================================================
  // REFRESH INDUSTRIES
  // ==========================================================================

  async function refreshIndustries() {
    const next =
      await fetchIndustries();

    setIndustries(
      next,
    );
  }


  // ==========================================================================
  // LOGIN SUCCESS
  // ==========================================================================

  async function handleAuthenticated() {
    try {
      setLoadError(null);

      const currentUser =
        await refreshUser();

      if (!currentUser) {
        setShowLogin(true);
        return;
      }

      await loadAppData();

      setShowLogin(
        false,
      );
    } catch (error: any) {
      setLoadError(
        error?.message ||
          "Could not load your account data.",
      );
    }
  }


  // ==========================================================================
  // LOGOUT
  // ==========================================================================

  function handleLogout() {
    logout();

    setUser(null);
    setIndustries(null);
    setSessionResults([]);
    setResult(null);

    setPdfBlob(null);
    setPdfUrl("");
    setSourceLabel("");

    setUploadError(null);
    setProcessError(null);
    setProcessing(false);

    setActiveTab(
      "process",
    );

    setScreen(1);

    setShowLogin(true);
  }


  // ==========================================================================
  // RESET DOCUMENT
  // ==========================================================================

  function resetDocumentState() {
    setPdfBlob(null);
    setPdfUrl("");
    setResult(null);
    setProcessError(null);
    setUploadError(null);
    setSourceLabel("");
  }


  // ==========================================================================
  // PROCESS FLOW
  // ==========================================================================

  function goToUpload() {
    setScreen(2);
  }


  function handleFile(
    file: File,
  ) {
    if (
      file.type !==
      "application/pdf"
    ) {
      setUploadError(
        "Unsupported file type. Please upload a PDF.",
      );

      return;
    }

    setUploadError(null);

    setPdfBlob(
      file,
    );

    setPdfUrl(
      URL.createObjectURL(
        file,
      ),
    );

    setSourceLabel(
      file.name,
    );

    setResult(null);

    setScreen(3);
  }


  async function handleUseDemo(
    negative: boolean,
  ) {
    if (!industry) {
      return;
    }

    try {
      const blob =
        await fetchDemoPdf(
          industry,
          negative,
        );

      setPdfBlob(
        blob,
      );

      setPdfUrl(
        URL.createObjectURL(
          blob,
        ),
      );

      setSourceLabel(
        `${industry}_${negative ? "negative_test" : "demo"}.pdf`,
      );

      setUploadError(
        null,
      );

      setResult(
        null,
      );

      setScreen(3);
    } catch (error: any) {
      setUploadError(
        error?.message ||
          "Could not load demo PDF.",
      );
    }
  }


  // ==========================================================================
  // PROCESS DOCUMENT
  // ==========================================================================

  async function handleProcess() {
    if (
      !industry ||
      !pdfBlob ||
      !industries
    ) {
      return;
    }

    setProcessing(
      true,
    );

    setProcessError(
      null,
    );

    try {
      const response =
        (
          await processDocument(
            industry,
            pdfBlob,
            sourceLabel ||
              "document.pdf",
          )
        ) as ProcessResultWithDocument;

      setResult(
        response,
      );

      const meta =
        industries[
          industry
        ];

      const fieldSchema =
        response.field_schema ||
        meta.fields ||
        [];

      const documentId =
        response.document_id;

      if (
        !documentId
      ) {
        throw new Error(
          "The document was processed, but the server did not return a document ID.",
        );
      }

      const newRecord:
        SessionRecord =
        {
          ...response,

          id: String(
            documentId,
          ),

          document_id:
            documentId,

          sourceLabel:
            sourceLabel ||
            "document.pdf",

          docTitle:
            meta.doc_title,

          industryLabel:
            meta.label,

          field_schema:
            fieldSchema,

          fieldSchema:
            fieldSchema,

          createdAt:
            new Date().toISOString(),
        };

      setSessionResults(
        (previous) => [
          newRecord,
          ...previous,
        ],
      );

      setScreen(4);
    } catch (error: any) {
      setProcessError(
        `Processing failed: ${
          error?.message ||
          "Unknown error"
        }.`,
      );
    } finally {
      setProcessing(
        false,
      );
    }
  }


  // ==========================================================================
  // RESULT UPDATE
  // ==========================================================================

  function handleResultUpdate(
    updated: ProcessResult,
  ) {
    setResult(
      updated,
    );

    setSessionResults(
      (previous) =>
        previous.map(
          (
            record,
            index,
          ) => {
            if (
              index !== 0
            ) {
              return record;
            }

            return {
              ...record,
              ...updated,

              // Preserve the historical field schema.
              field_schema:
                record.field_schema ||
                record.fieldSchema ||
                updated.field_schema ||
                [],

              fieldSchema:
                record.fieldSchema ||
                record.field_schema ||
                updated.field_schema ||
                [],
            };
          },
        ),
    );

    const documentId =
      (
        updated as
          ProcessResultWithDocument
      ).document_id;

    if (
      documentId
    ) {
      updateProcessedDocument(
        documentId,
        updated.extracted,
        updated.validation,
        updated.overall,
      ).catch(
        () => undefined,
      );
    }
  }


  // ==========================================================================
  // START OVER
  // ==========================================================================

  function startOver() {
    setScreen(1);
    setIndustry(
      null,
    );
    resetDocumentState();
  }


  // ==========================================================================
  // DELETE DOCUMENT
  // ==========================================================================

  async function handleDeleteDocument(
    documentId: number,
  ) {
    setSessionResults(
      (previous) =>
        previous.filter(
          (record) =>
            Number(
              record.document_id ??
                record.id,
            ) !==
            documentId,
        ),
    );

    const currentDocumentId =
      result
        ? Number(
            (
              result as
                ProcessResultWithDocument
            ).document_id ||
              0,
          )
        : 0;

    if (
      currentDocumentId ===
      documentId
    ) {
      startOver();
    }
  }


  // ==========================================================================
  // AUTH CHECKING
  // ==========================================================================

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" />

          <span className="text-inksoft text-sm font-mono">
            Checking login…
          </span>
        </div>
      </div>
    );
  }


  // ==========================================================================
  // LOGIN REQUIRED
  // ==========================================================================

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center mx-auto mb-5 shadow-glow">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z"
              />
            </svg>
          </div>

          <h1 className="font-display font-bold text-2xl text-ink">
            AI Document Automation MVP
          </h1>

          <p className="text-inksoft text-sm mt-2">
            {showLogin
              ? "Login or create an account to continue."
              : "Please login to continue."}
          </p>
        </div>

        {showLogin && (
          <LoginModal
            required
            onClose={() =>
              setShowLogin(
                true,
              )
            }
            onAuthenticated={
              handleAuthenticated
            }
          />
        )}
      </div>
    );
  }


  // ==========================================================================
  // LOAD ERROR
  // ==========================================================================

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl shadow-card p-8 max-w-md text-center">
          <p className="font-mono text-sm text-red-600 mb-2">
            Connection Error
          </p>

          <p className="text-inksoft text-sm">
            {loadError}
          </p>
        </div>
      </div>
    );
  }


  // ==========================================================================
  // INDUSTRIES LOADING
  // ==========================================================================

  if (!industries) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" />

          <span className="text-inksoft text-sm font-mono">
            Loading…
          </span>
        </div>
      </div>
    );
  }


  const meta =
    industry
      ? industries[industry]
      : null;


  // ==========================================================================
  // MAIN
  // ==========================================================================

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="bg-orb w-[500px] h-[500px] bg-primary/20 -top-[200px] -right-[200px] fixed pointer-events-none" />

      <div
        className="bg-orb w-[400px] h-[400px] bg-emerald-400/15 -bottom-[150px] -left-[150px] fixed pointer-events-none"
        style={{
          animationDelay:
            "3s",
        }}
      />

      <div className="relative max-w-[1080px] mx-auto px-6 sm:px-8 py-10 pb-24">

        {/* Header */}
        <div className="flex items-center justify-between mb-10 gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-glow">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z"
                />
              </svg>
            </div>

            <div>
              <h1 className="font-display font-bold text-xl tracking-tight text-ink">
                AI Document Automation MVP
              </h1>

              <p className="text-inksoft text-xs mt-0.5 truncate max-w-[420px]">
                Signed in as{" "}
                {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-inksoft bg-white border border-line rounded-full px-3 py-1.5 shadow-card">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
              Account Active
            </span>

            <button
              type="button"
              onClick={
                handleLogout
              }
              className="border border-line bg-white rounded-lg px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary hover:text-primary transition-colors"
            >
              Logout
            </button>
          </div>
        </div>


        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-line overflow-x-auto">
          <button
            type="button"
            onClick={() =>
              setActiveTab(
                "process",
              )
            }
            className={`whitespace-nowrap px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab ===
              "process"
                ? "border-primary text-ink"
                : "border-transparent text-inksoft hover:text-ink"
            }`}
          >
            Process New Document
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab(
                "validate",
              )
            }
            className={`whitespace-nowrap px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab ===
              "validate"
                ? "border-primary text-ink"
                : "border-transparent text-inksoft hover:text-ink"
            }`}
          >
            Existing Data Validation
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab(
                "fields",
              )
            }
            className={`whitespace-nowrap px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab ===
              "fields"
                ? "border-primary text-ink"
                : "border-transparent text-inksoft hover:text-ink"
            }`}
          >
            Field Settings
          </button>
        </div>


        {/* Process */}
        {activeTab ===
        "process" ? (
          <>
            <Stepper
              current={
                screen
              }
            />

            <div className="bg-white rounded-2xl shadow-card border border-line/50 p-6 sm:p-8 animate-fade-in">
              {screen === 1 && (
                <IndustrySelect
                  industries={
                    industries
                  }
                  selected={
                    industry
                  }
                  onSelect={
                    setIndustry
                  }
                  onContinue={
                    goToUpload
                  }
                />
              )}

              {screen === 2 &&
                industry &&
                meta && (
                  <UploadStep
                    industry={
                      industry
                    }
                    meta={meta}
                    error={
                      uploadError
                    }
                    onBack={() =>
                      setScreen(
                        1,
                      )
                    }
                    onFile={
                      handleFile
                    }
                    onUseDemo={() =>
                      handleUseDemo(
                        false,
                      )
                    }
                    onUseNegative={() =>
                      handleUseDemo(
                        true,
                      )
                    }
                  />
                )}

              {screen === 3 &&
                meta && (
                  <ProcessStep
                    meta={meta}
                    pdfUrl={
                      pdfUrl
                    }
                    sourceLabel={
                      sourceLabel
                    }
                    processing={
                      processing
                    }
                    error={
                      processError
                    }
                    onBack={() =>
                      setScreen(
                        2,
                      )
                    }
                    onProcess={
                      handleProcess
                    }
                  />
                )}

              {screen === 4 &&
                meta &&
                result && (
                  <ResultsStep
                    meta={meta}
                    result={
                      result
                    }
                    onAnother={
                      startOver
                    }
                    onBackToPreview={() =>
                      setScreen(
                        3,
                      )
                    }
                    onResultUpdate={
                      handleResultUpdate
                    }
                  />
                )}
            </div>


            <SessionList
              records={
                sessionResults
              }
              onDelete={
                handleDeleteDocument
              }
            />
          </>
        ) : activeTab ===
          "validate" ? (
          <DataValidationFlow
            industries={
              industries
            }
          />
        ) : (
          <FieldSettings
            industries={
              industries
            }
            onRefresh={
              refreshIndustries
            }
            isAuthenticated={
              Boolean(user)
            }
            onRequireLogin={() =>
              setShowLogin(
                true,
              )
            }
          />
        )}
      </div>
    </div>
  );
}