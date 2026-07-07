import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useADMStore } from '@/stores/admStore';
import App from '@/App';

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const loadProjectFromDB = useADMStore((s) => s.loadProjectFromDB);
  const currentProjectId = useADMStore((s) => s.currentProjectId);

  useEffect(() => {
    if (id && id !== currentProjectId) {
      loadProjectFromDB(id);
    }
  }, [id, currentProjectId, loadProjectFromDB]);

  return <App />;
}
