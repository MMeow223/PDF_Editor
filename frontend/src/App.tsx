import { DocumentList } from './components/DocumentList'
import { EditorLayout } from './components/editor/EditorLayout'
import { useEditorStore } from './store/editorStore'

export default function App() {
  const docId = useEditorStore(s => s.docId)
  return docId ? <EditorLayout /> : <DocumentList />
}
