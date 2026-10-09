import React from "react";
import { useNavigate, useParams } from "react-router";
import AuthContext from "../../AuthContext";
import { openPublic, PublicComposition, publicImageUrl, remix, SignInNeeded } from "../cloud/client";
import { kindLabel, nodeSummary, nodeTitle } from "./summaries";
import { SignInButton } from "./CloudSheets";
import "./Composer.css";

/** What someone sees when they open a shared link (wireframe B5): the result and how it's made. */
export default function PublicPage() {
  const { slug = '' } = useParams();
  const auth = AuthContext.useAuth();
  const navigate = useNavigate();
  const [shared, setShared] = React.useState<PublicComposition>();
  const [problem, setProblem] = React.useState<string>();
  const [remixing, setRemixing] = React.useState(false);

  React.useEffect(() => {
    openPublic(slug).then(setShared).catch(e => setProblem(String(e.message ?? e)));
  }, [slug]);

  const doRemix = async () => {
    setRemixing(true);
    try {
      const copy = await remix(auth.authenticatedFetch, slug);
      navigate(`/composer?open=${copy.id}`);
    } catch (e) {
      if (e instanceof SignInNeeded) auth.logout();
      setProblem(String((e as Error).message ?? e));
      setRemixing(false);
    }
  };

  return (
    <div className="composer" style={{ overflowY: 'auto' }}>
      <div className="composer-header">
        <a href="/composer" className="composer-icon-button" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>Warholizer</a>
        <span style={{ flexGrow: 1 }} />
      </div>
      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {problem && <div className="composer-card"><strong>Can't open this link</strong><span className="composer-hint">{problem}</span></div>}
        {!shared && !problem && <span className="composer-hint">Loading…</span>}
        {shared && (
          <>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{shared.name}</div>
              <div className="composer-hint">Shared composition · view only</div>
            </div>
            {shared.preview && <img src={publicImageUrl(slug, shared.preview)} alt={`Result of ${shared.name}`} style={{ width: '100%', borderRadius: 18, background: 'var(--c-raised)' }} />}
            <span className="composer-section-label">How it's made</span>
            <div className="composer-pill">
              <div className="composer-pill-main">
                <span className="composer-pill-kind">Input</span>
                <span className="composer-pill-summary">{shared.includeSources ? `${shared.inputCount} photos` : `${shared.inputCount} photos, not shared`}</span>
              </div>
              {shared.inputs && (
                <span className="composer-thumbs" style={{ flexGrow: 0 }}>
                  {shared.inputs.map(sha => <img key={sha} src={publicImageUrl(slug, sha, 'thumbnail')} alt="" className="composer-thumb" />)}
                </span>
              )}
            </div>
            {shared.document.root.children.map(step => (
              <div key={step.id} className="composer-pill">
                <div className="composer-pill-main">
                  <span className="composer-pill-kind">{kindLabel(step)}</span>
                  <span className="composer-pill-name">{nodeTitle(step)}</span>
                  <span className="composer-pill-summary">{nodeSummary(step, [])}</span>
                </div>
              </div>
            ))}
            <button type="button" className="composer-primary" onClick={() => navigate(`/composer?try=${slug}`)}>Try it with my photo</button>
            {shared.allowRemix && (auth.state
              ? <button type="button" className="composer-secondary" disabled={remixing} onClick={doRemix}>{remixing ? 'Copying…' : 'Remix into my library'}</button>
              : <div className="composer-card"><strong>Remix into my library</strong><span className="composer-hint">Sign in to keep a copy you can change.</span><SignInButton onSignedIn={doRemix} /></div>)}
            <span className="composer-hint">Trying works without an account, on this device.{shared.allowRemix ? ' Remixing saves a copy to your library.' : ''}</span>
          </>
        )}
      </div>
    </div>
  );
}
