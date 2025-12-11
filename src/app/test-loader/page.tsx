"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { IconSearch, IconCheck, IconAlertCircle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import SourcingLoader from "@/components/SourcingLoader";
import { SearchLoadingProgress } from "@/components/search/search-loading-progress";

type SearchStatus = "idle" | "generating" | "executing" | "polling" | "completed" | "error";

export default function TestLoaderPage() {
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("generating");
  const [searchStatusDetails, setSearchStatusDetails] = useState("Initializing...");

  // Simulate progress automatically
  const runSimulation = () => {
    setSearchStatus("generating");
    setSearchStatusDetails("Analyzing requirements...");
    
    setTimeout(() => {
      setSearchStatus("executing");
      setSearchStatusDetails("Launching search strategies...");
    }, 3000);

    setTimeout(() => {
      setSearchStatus("polling");
      setSearchStatusDetails("Found 5 candidates...");
    }, 6000);

    setTimeout(() => {
      setSearchStatusDetails("Found 12 candidates...");
    }, 8000);

    setTimeout(() => {
      setSearchStatus("completed");
      setSearchStatusDetails("Found 25 candidates");
    }, 10000);
  };

  return (
    <div className="min-h-screen p-8 flex flex-col items-center gap-8 bg-background">
      <div className="w-full max-w-md p-4 bg-muted/20 rounded-lg border border-border flex flex-wrap gap-2 justify-center">
        <Button size="sm" variant="outline" onClick={() => { setSearchStatus("generating"); setSearchStatusDetails("Analyzing..."); }}>Generating</Button>
        <Button size="sm" variant="outline" onClick={() => { setSearchStatus("executing"); setSearchStatusDetails("Launching..."); }}>Executing</Button>
        <Button size="sm" variant="outline" onClick={() => { setSearchStatus("polling"); setSearchStatusDetails("Found 8 candidates..."); }}>Polling</Button>
        <Button size="sm" variant="outline" onClick={() => { setSearchStatus("completed"); setSearchStatusDetails("Done"); }}>Completed</Button>
        <Button size="sm" variant="outline" onClick={() => { setSearchStatus("error"); setSearchStatusDetails("Failed to connect"); }}>Error</Button>
        <Button size="sm" onClick={runSimulation}>Run Simulation</Button>
      </div>

      <Card className="w-full max-w-4xl h-[600px] flex items-center justify-center relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key="loader"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg flex flex-col items-center text-center"
          >
            {/* Animated Sourcing Loader */}
            <div className="relative flex items-center justify-center w-full h-48 mb-8">
              {searchStatus === "error" ? (
                <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 ring-1 ring-red-500/20 shadow-sm">
                  <IconAlertCircle className="w-7 h-7 text-red-500" />
                </div>
              ) : (
                <SourcingLoader complete={searchStatus === "completed"} />
              )}
            </div>
            

            {/* Minimal Status Display */}
            <div className="flex flex-col items-center gap-2 mb-8">
              <h3 className="text-xl font-medium text-foreground">
                {searchStatusDetails || (
                  <>
                    {searchStatus === "generating" && "Analyzing requirements..."}
                    {searchStatus === "executing" && "Searching candidates..."}
                    {searchStatus === "polling" && "Finalizing results..."}
                    {searchStatus === "completed" && "Search complete"}
                    {searchStatus === "error" && "Search failed"}
                    {searchStatus === "idle" && "Preparing search..."}
                  </>
                )}
              </h3>
            </div>

            {searchStatus !== "completed" && searchStatus !== "error" && (
              <div className="w-full px-8 opacity-50 scale-90">
                <SearchLoadingProgress status={searchStatus} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </Card>
    </div>
  );
}



