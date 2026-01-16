// client/src/components/rehash/LenderConfigEditor.tsx
// Admin interface for modifying lender rules

import { useState, useEffect } from "react";
import {
  Settings,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Lender config type for the editor
export interface LenderConfigOverride {
  id: string;
  name: string;
  allowGAP: boolean;
  allowVSC: boolean;
  aprOverride?: number;
  maxLTVOverride?: number;
  active: boolean;
}

// Default lender configurations
const DEFAULT_LENDER_CONFIGS: LenderConfigOverride[] = [
  {
    id: "westlake",
    name: "Westlake Financial",
    allowGAP: true,
    allowVSC: true,
    active: true,
  },
  {
    id: "western_funding",
    name: "Western Funding",
    allowGAP: true,
    allowVSC: true,
    active: true,
  },
  {
    id: "uac",
    name: "United Auto Credit",
    allowGAP: true,
    allowVSC: true,
    active: true,
  },
];

const STORAGE_KEY = "lenderConfigOverrides";

// Helper to load configs from localStorage
function loadLenderConfigs(): LenderConfigOverride[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to load lender configs from localStorage:", e);
  }
  return DEFAULT_LENDER_CONFIGS;
}

// Helper to save configs to localStorage
function saveLenderConfigs(configs: LenderConfigOverride[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch (e) {
    console.warn("Failed to save lender configs to localStorage:", e);
  }
}

interface LenderConfigEditorProps {
  onConfigChange?: (configs: LenderConfigOverride[]) => void;
}

export function LenderConfigEditor({ onConfigChange }: LenderConfigEditorProps) {
  const [configs, setConfigs] = useState<LenderConfigOverride[]>(loadLenderConfigs);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Update parent when configs change
  useEffect(() => {
    onConfigChange?.(configs);
  }, [configs, onConfigChange]);

  const handleConfigChange = (
    index: number,
    field: keyof LenderConfigOverride,
    value: LenderConfigOverride[keyof LenderConfigOverride]
  ) => {
    const updated = [...configs];
    (updated[index] as any)[field] = value;
    setConfigs(updated);
    setHasChanges(true);
    setSaveStatus("idle");
  };

  const handleSave = () => {
    setSaveStatus("saving");
    saveLenderConfigs(configs);
    setTimeout(() => {
      setSaveStatus("saved");
      setHasChanges(false);
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 300);
  };

  const handleReset = () => {
    setConfigs(DEFAULT_LENDER_CONFIGS);
    saveLenderConfigs(DEFAULT_LENDER_CONFIGS);
    setHasChanges(false);
    setSaveStatus("idle");
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full"
        >
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            Lender Configuration
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="outline" className="text-amber-600 border-amber-600">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unsaved
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Customize lender settings for this session. Changes persist in your browser.
          </p>

          {/* Lender List */}
          <div className="space-y-3">
            {configs.map((config, index) => (
              <div
                key={config.id}
                className={cn(
                  "p-3 rounded-md border",
                  config.active ? "bg-background" : "bg-muted/50 opacity-60"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.active}
                      onChange={(e) =>
                        handleConfigChange(index, "active", e.target.checked)
                      }
                      className="h-4 w-4 rounded"
                    />
                    <span className="font-medium text-sm">{config.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {config.id}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* GAP Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.allowGAP}
                      onChange={(e) =>
                        handleConfigChange(index, "allowGAP", e.target.checked)
                      }
                      disabled={!config.active}
                      className="h-4 w-4 rounded"
                    />
                    <span className="text-xs">Allow GAP</span>
                  </label>

                  {/* VSC Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.allowVSC}
                      onChange={(e) =>
                        handleConfigChange(index, "allowVSC", e.target.checked)
                      }
                      disabled={!config.active}
                      className="h-4 w-4 rounded"
                    />
                    <span className="text-xs">Allow VSC</span>
                  </label>

                  {/* APR Override */}
                  <div className="space-y-1">
                    <Label className="text-xs">APR Override</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Auto"
                      value={config.aprOverride ?? ""}
                      onChange={(e) =>
                        handleConfigChange(
                          index,
                          "aprOverride",
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                      disabled={!config.active}
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* Max LTV Override */}
                  <div className="space-y-1">
                    <Label className="text-xs">Max LTV %</Label>
                    <Input
                      type="number"
                      placeholder="Auto"
                      value={config.maxLTVOverride ?? ""}
                      onChange={(e) =>
                        handleConfigChange(
                          index,
                          "maxLTVOverride",
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                      disabled={!config.active}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset to Defaults
            </Button>

            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || saveStatus === "saving"}
              className="text-xs"
            >
              {saveStatus === "saving" ? (
                "Saving..."
              ) : saveStatus === "saved" ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="h-3 w-3 mr-1" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Export helper to get current configs
export function getLenderConfigOverrides(): LenderConfigOverride[] {
  return loadLenderConfigs();
}

export default LenderConfigEditor;
