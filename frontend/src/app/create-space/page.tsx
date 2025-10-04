"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getTokenData, clearTokenData } from "@/utils/auth";

type SpaceRequestBody =
  | { name: string; mapId: string }
  | { name: string; dimensions: string };

interface MapTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnail: string | null;
}

export default function CreateSpacePage() {
  const [createdSpaceId, setCreatedSpaceId] = useState<string | null>(null);
  const router = useRouter();
  const [maps, setMaps] = useState<MapTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [spaceName, setSpaceName] = useState("");
  const [customWidth, setCustomWidth] = useState(800);
  const [customHeight, setCustomHeight] = useState(600);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchMaps = useCallback(async () => {
    if (typeof window === "undefined") return;
    setIsLoading(true);
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        setError("No token found. Please log in again.");
        clearTokenData();
        router.push("/login");
        return;
      }

      const response = await fetch(
        "process.env.NEXT_PUBLIC_API_URL/user/space/maps/refernce",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenData.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        // Try to read error message as text
        const errorText = await response.text();
        if (response.status === 401) {
          setError("Session expired. Please log in again.");
          clearTokenData();
          router.push("/login");
          return;
        } else {
          setError(errorText || "Failed to fetch map templates");
          return;
        }
      }

      // Only parse as JSON if response is OK
      const data = await response.json();
      setMaps(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch map templates");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      fetchMaps();
    }
  }, [fetchMaps]);

  const handleCreateSpace = async () => {
    if (!spaceName.trim()) {
      setError("Space name is required");
      return;
    }

    setCreating(true);
    setError("");
    try {
      const tokenData = getTokenData();
      console.log("tokenData in CreateSpacePage:", tokenData);
      if (!tokenData?.token) {
        setError("No token found. Please log in again.");
        clearTokenData();
        router.push("/login");
        return;
      }

      let body: SpaceRequestBody;
      if (selectedMapId) {
        body = { name: spaceName.trim(), mapId: selectedMapId };
      } else {
        body = {
          name: spaceName.trim(),
          dimensions: `${customWidth}x${customHeight}`,
        };
      }
console.log("tokenData in CreateSpacePage:", tokenData);
console.log('i am sending the data to the route')
      const response = await fetch("process.env.NEXT_PUBLIC_API_URL/space/", {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (response.ok && data.spaceId) {
        setCreatedSpaceId(data.spaceId);
      } else {
        setError(data.error || "Failed to create space");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to create space");
    } finally {
      setCreating(false);
    }
  };

  if (createdSpaceId) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-8 bg-white rounded shadow">
        <h2 className="text-2xl font-bold mb-4">Space Created!</h2>
        <p className="mb-2">Share this link so others can join your space:</p>
        <div className="bg-gray-100 rounded px-4 py-2 mb-4 font-mono">
          {`${window.location.origin}/space/${createdSpaceId}`}
        </div>
        <button
          className="bg-indigo-600 text-white px-4 py-2 rounded"
          onClick={() => router.push(`/space/${createdSpaceId}`)}
        >
          Go to Space
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto mt-12 p-8 bg-white rounded shadow">
      <h1 className="text-3xl font-bold mb-6">Create Your Space</h1>

      {/* Map templates */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Choose a Map Template</h2>
        {isLoading ? (
          <div>Loading maps...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {maps.map((map) => (
              <div
                key={map.id}
                className={`border rounded-lg p-4 cursor-pointer transition-shadow ${
                  selectedMapId === map.id
                    ? "border-indigo-500 shadow-lg"
                    : "hover:shadow"
                }`}
                onClick={() => setSelectedMapId(map.id)}
              >
                {map.thumbnail && (
                  <Image
                    src={map.thumbnail}
                    alt={map.name}
                    width={400}
                    height={128}
                    className="w-full h-32 object-cover rounded mb-2"
                  />
                )}
                <h3 className="text-lg font-bold mb-1">{map.name}</h3>
                <p className="text-sm text-gray-600 mb-1">
                  Dimensions: {map.width} × {map.height}
                </p>
                <p className="text-xs text-gray-400">
                  ID: {map.id.slice(0, 8)}...
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Space details */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Space Details</h2>
        <label className="block mb-2 font-medium">Space Name</label>
        <input
          type="text"
          value={spaceName}
          onChange={(e) => setSpaceName(e.target.value)}
          className="w-full px-3 py-2 border rounded mb-4"
          placeholder="Enter space name"
        />

        {!selectedMapId && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block mb-1">Width</label>
              <input
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(Number(e.target.value))}
                min={400}
                max={2000}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block mb-1">Height</label>
              <input
                type="number"
                value={customHeight}
                onChange={(e) => setCustomHeight(Number(e.target.value))}
                min={300}
                max={1500}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>
        )}
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      <button
        className="bg-indigo-600 text-white px-6 py-3 rounded font-bold text-lg w-full"
        onClick={handleCreateSpace}
        disabled={creating}
      >
        {creating ? "Creating..." : "Create Space"}
      </button>
    </div>
  );
}
