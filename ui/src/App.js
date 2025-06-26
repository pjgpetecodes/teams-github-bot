import React, { useEffect, useState } from 'react';
import { DefaultButton } from '@fluentui/react';

function App() {
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch('/api/summary')
      .then(res => res.json())
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  const createIssue = async () => {
    setStatus('Creating issue...');
    const res = await fetch('/api/create-issue', { method: 'POST' });
    if (res.ok) {
      setStatus('GitHub issue created and assigned to copilot!');
    } else {
      setStatus('Failed to create issue.');
    }
  };

  return (
    <div style={{ padding: 32, fontFamily: 'Segoe UI' }}>
      <h2>Meeting Summary</h2>
      {summary ? (
        <>
          <pre style={{ background: '#f3f3f3', padding: 16 }}>{summary.body}</pre>
          <DefaultButton onClick={createIssue}>Create GitHub Issue</DefaultButton>
        </>
      ) : (
        <p>No summary available yet.</p>
      )}
      {status && <p>{status}</p>}
    </div>
  );
}

export default App;
