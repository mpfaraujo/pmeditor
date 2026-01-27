import { QuestionEditor } from "@/components/editor/QuestionEditor";

export default function EditorPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          Editor de Questões
        </h1>
        <QuestionEditor />
      </div>
    </div>
  );
}