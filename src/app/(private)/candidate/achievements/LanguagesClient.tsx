"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function LanguagesClient({ initialItems }: any) {
  const supabase = createClient();
  const [items, setItems] = useState(initialItems || []);
  const [newItem, setNewItem] = useState({ language: "", level: "B1", title: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  async function addLanguage() {
    if (!newItem.language) return;

    const { data, error } = await supabase
      .from("candidate_languages")
      .insert({
        language: newItem.language,
        level: newItem.level,
        title: newItem.title,
      })
      .select("*")
      .single();

    if (!error && data) {
      setItems((prev: any) => [data, ...prev]);
      setNewItem({ language: "", level: "B1", title: "" });
    }
  }

  async function updateItem(id: string, field: string, value: string) {
    const { error } = await supabase
      .from("candidate_languages")
      .update({ [field]: value })
      .eq("id", id);

    if (!error) {
      setItems((prev: any) =>
        prev.map((i: any) => (i.id === id ? { ...i, [field]: value } : i))
      );
    }
  }

  async function deleteItem(id: string) {
    await supabase.from("candidate_languages").delete().eq("id", id);
    setItems((prev: any) => prev.filter((i: any) => i.id !== id));
  }

  return (
    <div className="space-y-4">

      {/* ADD */}
      <div className="flex gap-2">
        <input
          placeholder="Idioma"
          value={newItem.language}
          onChange={(e) => setNewItem({ ...newItem, language: e.target.value })}
          className="border px-3 py-2 rounded-lg text-sm"
        />
        <select
          value={newItem.level}
          onChange={(e) => setNewItem({ ...newItem, level: e.target.value })}
          className="border px-3 py-2 rounded-lg text-sm"
        >
          <option>A1</option><option>A2</option>
          <option>B1</option><option>B2</option>
          <option>C1</option><option>C2</option>
        </select>
        <input
          placeholder="Título (opcional)"
          value={newItem.title}
          onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
          className="border px-3 py-2 rounded-lg text-sm flex-1"
        />
        <button
          onClick={addLanguage}
          className="bg-blue-700 text-white px-4 rounded-lg text-sm"
        >
          Añadir
        </button>
      </div>

      {/* LIST */}
      <div className="space-y-2">
        {items.map((item: any) => (
          <div
            key={item.id}
            className="flex items-center justify-between border rounded-lg px-4 py-3 bg-white"
          >
            {editingId === item.id ? (
              <>
                <input
                  value={item.language}
                  onChange={(e) => updateItem(item.id, "language", e.target.value)}
                  className="border px-2 py-1 text-sm rounded"
                />
                <select
                  value={item.level}
                  onChange={(e) => updateItem(item.id, "level", e.target.value)}
                  className="border px-2 py-1 text-sm rounded"
                >
                  <option>A1</option><option>A2</option>
                  <option>B1</option><option>B2</option>
                  <option>C1</option><option>C2</option>
                </select>
                <input
                  value={item.title || ""}
                  onChange={(e) => updateItem(item.id, "title", e.target.value)}
                  className="border px-2 py-1 text-sm rounded"
                />
                <button onClick={() => setEditingId(null)}>OK</button>
              </>
            ) : (
              <>
                <div className="flex gap-4 items-center">
                  <span className="font-semibold">{item.language}</span>
                  <span className="text-sm text-gray-600">{item.level}</span>
                  {item.title && (
                    <span className="text-sm text-gray-500">{item.title}</span>
                  )}
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    Autodeclarado
                  </span>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setEditingId(item.id)}>Editar</button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="text-red-600"
                  >
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
