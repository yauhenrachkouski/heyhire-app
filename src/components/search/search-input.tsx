"use client";

import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Mic } from "lucide-react";
import { parseQueryWithClaude } from "@/actions/search";
import type { ParsedQuery } from "@/types/search";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";

interface SearchInputProps {
  onQueryParsed: (query: ParsedQuery) => void;
  onParsingChange?: (isParsing: boolean) => void;
  onSearch?: () => Promise<void>;
  isLoading?: boolean;
  hasParsedQuery?: boolean;
  value?: string; // Allow controlled query value
  onQueryTextChange?: (text: string) => void; // Notify parent of text changes
}

export function SearchInput({ 
  onQueryParsed, 
  onParsingChange, 
  onSearch, 
  isLoading = false, 
  hasParsedQuery = false,
  value,
  onQueryTextChange
}: SearchInputProps) {
  const [query, setQuery] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const { toast } = useToast();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Update query when value prop changes
  useEffect(() => {
    if (value !== undefined) {
      setQuery(value);
    }
  }, [value]);

  const handleParse = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      return;
    }

    setIsParsing(true);
    onParsingChange?.(true);
    try {
      const result = await parseQueryWithClaude(searchQuery);
      if (result.success && result.data) {
        onQueryParsed(result.data);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to parse query",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
      onParsingChange?.(false);
    }
  };

  const debouncedParse = useDebouncedCallback(handleParse, 800);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setQuery(value);
    onQueryTextChange?.(value);
    debouncedParse(value);
  };

  const handleMicClick = async () => {
    if (!isRecording) {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          // Stop all tracks
          stream.getTracks().forEach((track) => track.stop());

          // Create blob and send to Whisper
          const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
          await transcribeWithWhisper(audioBlob);
        };

        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
      } catch (error) {
        console.error("Microphone error:", error);
        toast({
          title: "Error",
          description: "Failed to access microphone",
          variant: "destructive",
        });
      }
    } else {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    }
  };

  const transcribeWithWhisper = async (audioBlob: Blob) => {
    try {
      setIsTranscribing(true);
      setIsParsing(true);

      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");

      // Send to our secure backend API route (OpenAI key stays private)
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Transcription failed");
      }

      const data = await response.json();
      const transcribedText = data.text;

      setIsTranscribing(false);

      // Set the query with transcribed text
      const newQuery = transcribedText;
      setQuery(newQuery);
      onQueryTextChange?.(newQuery);

      // Automatically parse the transcribed text
      await handleParse(transcribedText);
    } catch (error) {
      console.error("Transcription error:", error);
      toast({
        title: "Error",
        description: "Failed to transcribe audio",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
      setIsParsing(false);
    }
  };

  const handleButtonClick = async () => {
    if (!onSearch) return;
    setIsSearching(true);
    try {
      await onSearch();
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative flex items-start">
        <button
          type="button"
          onClick={handleMicClick}
          disabled={isLoading || isParsing || isTranscribing}
          className={`absolute left-3 top-3 flex items-center justify-center p-2 rounded-md transition-colors z-10 ${
            isRecording
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-transparent text-blue-600 hover:bg-blue-50"
          }`}
          title={isRecording ? "Stop recording" : "Start recording"}
        >
          <Mic className="h-4 w-4" />
        </button>
        <Textarea
          placeholder="Software engineer with next.js skills living in Miami"
          value={query}
          onChange={handleInputChange}
          disabled={isLoading || isRecording || isTranscribing}
          className="pl-12 pr-14 pt-3 pb-12 text-sm border-0 min-h-[80px] resize-none bg-white"
          rows={3}
        />
        {hasParsedQuery && (
          <button
            type="button"
            onClick={handleButtonClick}
            disabled={isParsing || isLoading || isSearching || !query.trim() || isRecording || isTranscribing}
            className="absolute right-3 bottom-3 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 cursor-pointer flex items-center justify-center p-2 rounded-md z-10"
            title="Start sourcing"
          >
            {isRecording ? (
              <span className="inline-block animate-pulse w-2 h-2 bg-red-500 rounded-full"></span>
            ) : isTranscribing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isParsing || isSearching || isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      <p className="text-sm text-white/50 mt-2 px-1">
        Enter job description, and we will find suitable candidates for you
      </p>
    </div>
  );
}
