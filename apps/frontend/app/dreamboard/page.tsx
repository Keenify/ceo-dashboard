"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import { Toaster } from "sonner";

// Dynamic imports for Konva components to avoid SSR issues
const DreamboardCanvas = dynamic(() => import("@/components/dreamboard/DreamboardCanvas"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full">Loading canvas...</div>
});

const DreamboardToolbar = dynamic(() => import("@/components/dreamboard/DreamboardToolbar"), {
  ssr: false,
  loading: () => <div className="h-16 bg-white border-b"></div>
});

type DreamboardItem = Database["public"]["Tables"]["dreamboard_items"]["Row"];

export default function Dreamboard() {
  const [user, setUser] = useState<any>(null);
  const [items, setItems] = useState<DreamboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<"select" | "text" | "draw" | "image">("select");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const router = useRouter();

  // Debug: Log items state changes
  useEffect(() => {
    console.log("Items state updated:", items.length, "items");
    items.forEach((item, index) => {
      console.log(`Item ${index}:`, item.type, item.id, item.content?.substring(0, 50));
    });
  }, [items]);

  useEffect(() => {
    const getUser = async () => {
      setLoading(true);
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        router.push("/login");
        return;
      }
      setUser(data.user);
      await loadItems(data.user.id);
      setLoading(false);
    };

    getUser();
  }, [router]);

  const loadItems = async (userId: string) => {
    console.log("Loading items for user:", userId);
    const { data, error } = await supabase
      .from("dreamboard_items")
      .select("*")
      .eq("user_id", userId)
      .order("z_index", { ascending: true });

    if (error) {
      console.error("Error loading dreamboard items:", error);
    } else {
      console.log("Loaded items:", data);
      setItems(data || []);
    }
  };

  const handleItemUpdate = async (itemId: string, updates: Partial<DreamboardItem>) => {
    const { error } = await supabase
      .from("dreamboard_items")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", itemId);

    if (error) {
      console.error("Error updating item:", error);
    } else {
      setItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      ));
    }
  };

  const handleItemCreate = async (newItem: Database["public"]["Tables"]["dreamboard_items"]["Insert"]) => {
    console.log("Creating item:", newItem);
    try {
      // Use sequential z_index instead of timestamp
      const maxZIndex = Math.max(...items.map(item => item.z_index || 0), 0);
      const itemWithZIndex = {
        ...newItem,
        z_index: maxZIndex + 1
      };
      
      const { data, error } = await supabase
        .from("dreamboard_items")
        .insert(itemWithZIndex)
        .select()
        .single();

      if (error) {
        console.error("Database error creating item:", error);
        throw new Error(`Database error: ${error.message}`);
      } else if (data) {
        console.log("Item created successfully:", data);
        setItems(prev => [...prev, data]);
        return data;
      }
    } catch (error) {
      console.error("Error creating item:", error);
      throw error;
    }
  };

  const handleItemDelete = async (itemId: string) => {
    const { error } = await supabase
      .from("dreamboard_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      console.error("Error deleting item:", error);
    } else {
      setItems(prev => prev.filter(item => item.id !== itemId));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Dreamboard</h1>
        </div>
      </header>

      {/* Toolbar */}
      <DreamboardToolbar 
        selectedTool={selectedTool}
        onToolChange={setSelectedTool}
        onItemCreate={handleItemCreate}
        userId={user?.id}
        selectedItemId={selectedItemId}
        items={items}
        onItemUpdate={handleItemUpdate}
        onItemDelete={handleItemDelete}
        onItemSelect={setSelectedItemId}
        selectedItems={selectedItems}
      />

      {/* Canvas */}
      <div className="flex-1 relative min-h-0">
        <DreamboardCanvas
          items={items}
          selectedTool={selectedTool}
          onItemUpdate={handleItemUpdate}
          onItemCreate={handleItemCreate}
          onItemDelete={handleItemDelete}
          userId={user?.id}
          selectedItemId={selectedItemId}
          onItemSelect={setSelectedItemId}
          onSelectedItemsChange={setSelectedItems}
        />
      </div>
    </div>
  );
} 