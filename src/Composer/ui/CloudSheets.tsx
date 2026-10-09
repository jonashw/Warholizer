import { GoogleLogin } from "@react-oauth/google";
import React from "react";
import type { User } from "../../../api/auth.mts";
import AuthContext from "../../AuthContext";
import {
  deleteComposition, Fetcher, fetchImage, LibraryImage, listCompositions, listImages, publicUrl, removeImage,
  SavedComposition, setSharing, SignInNeeded,
} from "../cloud/client";
import { Segmented } from "./Segmented";

/** Signs in with Google and registers the person (the same flow as the original login page). */
export function SignInButton({ onSignedIn }: { onSignedIn?: () => void }) {
  const auth = AuthContext.useAuth();
  const [problem, setProblem] = React.useState<string>();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <GoogleLogin
        text="continue_with"
        shape="pill"
        onSuccess={async credential => {
          const idToken = credential.credential;
          if (!idToken) return setProblem('Google did not return a credential.');
          const body = new FormData();
          body.append('id_token', idToken);
          const response = await fetch('/api/auth', { method: 'POST', body }).then(r => r.json()).catch(() => ({ error: 'Network error' }));
          if (response.error) return setProblem(`Sign-in failed: ${response.error}`);
          auth.login(idToken, response as User);
          onSignedIn?.();
        }}
        onError={() => setProblem('Sign-in was cancelled or failed.')} />
      {problem && <span className="composer-hint" style={{ color: 'var(--c-danger)' }}>{problem}</span>}
    </div>
  );
}

/** A library image's thumbnail, fetched with the person's token (images are private). */
function Thumbnail({ fetcher, sha256, hasThumbnail, onBackfilled }: { fetcher: Fetcher, sha256: string, hasThumbnail: boolean, onBackfilled?: () => void }) {
  const [url, setUrl] = React.useState<string>();
  React.useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    (async () => {
      const blob = await fetchImage(fetcher, sha256, hasThumbnail ? 'thumbnail' : 'original');
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      if (!hasThumbnail && blob.type.startsWith('image/')) {
        // Images stored without a thumbnail get one the first time they are shown.
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
        const { uploadImage } = await import('../cloud/client');
        await uploadImage(fetcher, blob, canvas, 'photo').catch(() => undefined);
        onBackfilled?.();
      }
    })().catch(() => undefined);
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [fetcher, sha256, hasThumbnail, onBackfilled]);
  return url ? <img src={url} alt="" className="composer-library-image" /> : <div className="composer-library-image" />;
}

export function LibrarySheet({ currentId, onOpen, onUseImages, onSave, onClose }: {
  currentId?: string,
  onOpen: (id: string) => void,
  onUseImages: (images: LibraryImage[], mode: 'replace' | 'add') => void,
  onSave: () => void,
  onClose: () => void,
}) {
  const auth = AuthContext.useAuth();
  const fetcher = auth.authenticatedFetch;
  const [tab, setTab] = React.useState<'compositions' | 'images'>('compositions');
  const [compositions, setCompositions] = React.useState<SavedComposition[]>();
  const [images, setImages] = React.useState<LibraryImage[]>();
  const [selected, setSelected] = React.useState<string[]>([]);
  const [problem, setProblem] = React.useState<string>();
  const [version, setVersion] = React.useState(0);
  const refresh = React.useCallback(() => setVersion(v => v + 1), []);
  const user = auth.state?.user;

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([listCompositions(fetcher), listImages(fetcher)])
      .then(([c, i]) => { if (!cancelled) { setCompositions(c); setImages(i); } })
      .catch(e => {
        if (e instanceof SignInNeeded) auth.logout();
        else if (!cancelled) setProblem(String(e.message ?? e));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, version]);

  if (!user) {
    return (
      <>
        <div className="composer-handle" />
        <div className="composer-sheet-header">
          <div className="composer-sheet-title"><strong>Library</strong><span>Your compositions and images, on every device</span></div>
          <button type="button" className="composer-icon-button" onClick={onClose}>Close</button>
        </div>
        <SignInButton />
        <span className="composer-hint">Without an account, work stays on this device. Images are private; nothing is public unless you share a link.</span>
      </>
    );
  }

  const chosen = (images ?? []).filter(i => selected.includes(i.sha256));
  return (
    <>
      <div className="composer-handle" />
      <div className="composer-sheet-header">
        <div className="composer-sheet-title"><strong>Library</strong><span>{user.email}</span></div>
        <button type="button" className="composer-icon-button" onClick={() => { auth.logout(); onClose(); }}>Sign out</button>
        <button type="button" className="composer-icon-button" onClick={onClose}>Close</button>
      </div>
      <Segmented label="Library" value={tab} onChange={setTab}
        options={[{ value: 'compositions', label: 'Compositions' }, { value: 'images', label: 'Images' }]} />
      {problem && <span className="composer-hint" style={{ color: 'var(--c-danger)' }}>{problem}</span>}
      {tab === 'compositions' ? (
        <>
          <button type="button" className="composer-primary" onClick={onSave}>{currentId ? 'Save this composition' : 'Save this composition to the library'}</button>
          {!compositions && <span className="composer-hint">Loading…</span>}
          {compositions?.length === 0 && <span className="composer-hint">Nothing saved yet.</span>}
          <div className="composer-library-grid">
            {compositions?.map(c => (
              <div key={c.id} className={'composer-library-card' + (c.id === currentId ? ' current' : '')}>
                <button type="button" className="composer-library-open" onClick={() => onOpen(c.id)}>
                  {c.preview ? <Thumbnail fetcher={fetcher} sha256={c.preview} hasThumbnail /> : <div className="composer-library-image" />}
                  <strong>{c.name}</strong>
                  <span>{new Date(c.updatedAt).toLocaleString()} · revision {c.revision}</span>
                  {c.share.public && <span className="composer-public-badge">Public link on</span>}
                </button>
                <button type="button" className="composer-icon-button composer-danger" aria-label={`Delete ${c.name}`}
                  onClick={async () => {
                    if (!window.confirm(`Delete "${c.name}" and its history?`)) return;
                    await deleteComposition(fetcher, c.id).catch(e => setProblem(String(e.message ?? e)));
                    refresh();
                  }}>Delete</button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <span className="composer-hint">{images ? `${images.length} images` : 'Loading…'} · originals kept exactly as uploaded</span>
          <div className="composer-library-images">
            {images?.map(i => {
              const on = selected.includes(i.sha256);
              return (
                <button key={i.sha256} type="button" className={'composer-library-tile' + (on ? ' on' : '')} aria-pressed={on} title={i.fileName}
                  onClick={() => setSelected(s => on ? s.filter(x => x !== i.sha256) : [...s, i.sha256])}>
                  <Thumbnail fetcher={fetcher} sha256={i.sha256} hasThumbnail={i.hasThumbnail} onBackfilled={refresh} />
                </button>
              );
            })}
          </div>
          {chosen.length > 0 && (
            <div className="composer-row">
              <button type="button" className="composer-primary" onClick={() => onUseImages(chosen, 'replace')}>Use {chosen.length} as the input</button>
              <button type="button" className="composer-secondary" onClick={() => onUseImages(chosen, 'add')}>Add to the input</button>
              <button type="button" className="composer-secondary composer-danger" onClick={async () => {
                if (!window.confirm(`Remove ${chosen.length} from your library? Saved compositions that use them keep working.`)) return;
                await Promise.all(chosen.map(i => removeImage(fetcher, i.sha256)));
                setSelected([]);
                refresh();
              }}>Remove</button>
            </div>
          )}
        </>
      )}
    </>
  );
}

export function ShareSheet({ saved, onChange, onClose }: {
  saved: SavedComposition, onChange: (saved: SavedComposition) => void, onClose: () => void,
}) {
  const fetcher = AuthContext.useAuth().authenticatedFetch;
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const update = async (settings: { public: boolean, includeSources?: boolean, allowRemix?: boolean }) => {
    setBusy(true);
    try {
      onChange(await setSharing(fetcher, saved.id, settings));
    } finally {
      setBusy(false);
    }
  };
  const url = saved.share.slug ? publicUrl(saved.share.slug) : undefined;
  const toggle = (label: string, hint: string, value: boolean, set: (v: boolean) => void) => (
    <div className="composer-setting composer-setting-inline">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <strong>{label}</strong>
        <span className="composer-hint">{hint}</span>
      </div>
      <button type="button" role="switch" aria-checked={value} aria-label={label} className="composer-switch" disabled={busy} onClick={() => set(!value)}><span /></button>
    </div>
  );
  return (
    <>
      <div className="composer-handle" />
      <div className="composer-sheet-header">
        <div className="composer-sheet-title"><strong>Share "{saved.name}"</strong><span>Revision {saved.revision}</span></div>
        <button type="button" className="composer-icon-button" onClick={onClose}>Done</button>
      </div>
      {toggle('Public link', 'Anyone with the link can view', saved.share.public, v => update({ public: v }))}
      {saved.share.public && url && (
        <>
          <div className="composer-row" style={{ flexWrap: 'nowrap' }}>
            <code className="composer-link">{url}</code>
            <button type="button" className="composer-secondary" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); }}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
          {'share' in navigator && (
            <button type="button" className="composer-secondary" onClick={() => navigator.share({ title: saved.name, url }).catch(() => undefined)}>Share to…</button>
          )}
          {toggle('Include my source photos', 'Off: viewers see the result and the steps, not your originals', saved.share.includeSources, v => update({ public: true, includeSources: v }))}
          {toggle('Allow remix', 'Viewers can copy the composition into their library', saved.share.allowRemix, v => update({ public: true, allowRemix: v }))}
          <span className="composer-hint">The link shows the latest saved revision. Turning the link off and on again makes a new link.</span>
        </>
      )}
    </>
  );
}
