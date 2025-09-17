"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { ArrowLeft, Info, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
        Card,
        CardContent,
        CardDescription,
        CardFooter,
        CardHeader,
        CardTitle,
} from "@/components/ui/card";
import {
        Form,
        FormControl,
        FormDescription,
        FormField,
        FormItem,
        FormLabel,
        FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EnumConnectorName } from "@/contracts/enums/connector";
import { getConnectorIcon } from "@/contracts/enums/connectorIcons";
import { useSearchSourceConnectors } from "@/hooks/useSearchSourceConnectors";

const mcpoConnectorFormSchema = z.object({
        name: z.string().min(3, {
                message: "Connector name must be at least 3 characters.",
        }),
        baseUrl: z.string().url({ message: "Enter a valid MCPO base URL." }),
        serverId: z.string().min(1, { message: "Server identifier is required." }),
        toolName: z.string().min(1, { message: "Tool name is required." }),
        apiKey: z.string().optional(),
        queryParam: z.string().optional(),
        staticArgs: z.string().optional(),
        resultPath: z.string().optional(),
        timeout: z.string().optional(),
});

type McpoConnectorFormValues = z.infer<typeof mcpoConnectorFormSchema>;

export default function McpoConnectorPage() {
        const router = useRouter();
        const params = useParams();
        const searchSpaceId = params.search_space_id as string;
        const [isSubmitting, setIsSubmitting] = useState(false);
        const { createConnector } = useSearchSourceConnectors();

        const form = useForm<McpoConnectorFormValues>({
                resolver: zodResolver(mcpoConnectorFormSchema),
                defaultValues: {
                        name: "MCPO Connector",
                        baseUrl: "",
                        serverId: "",
                        toolName: "",
                        apiKey: "",
                        queryParam: "query",
                        staticArgs: "",
                        resultPath: "",
                        timeout: "30",
                },
        });

        const onSubmit = async (values: McpoConnectorFormValues) => {
                setIsSubmitting(true);

                try {
                        let staticArgs: Record<string, unknown> = {};
                        if (values.staticArgs && values.staticArgs.trim()) {
                                try {
                                        const parsed = JSON.parse(values.staticArgs);
                                        if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
                                                throw new Error("Static arguments must be a JSON object");
                                        }
                                        staticArgs = parsed as Record<string, unknown>;
                                } catch (error) {
                                        form.setError("staticArgs", {
                                                type: "manual",
                                                message: error instanceof Error ? error.message : "Static arguments must be valid JSON.",
                                        });
                                        setIsSubmitting(false);
                                        return;
                                }
                        }

                        let timeoutValue: number | undefined;
                        if (values.timeout && values.timeout.trim()) {
                                const parsedTimeout = Number(values.timeout);
                                if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
                                        form.setError("timeout", {
                                                type: "manual",
                                                message: "Timeout must be a positive number.",
                                        });
                                        setIsSubmitting(false);
                                        return;
                                }
                                timeoutValue = parsedTimeout;
                        }

                        const queryParam = values.queryParam?.trim() || "query";
                        const config: Record<string, unknown> = {
                                MCPO_BASE_URL: values.baseUrl.trim(),
                                MCPO_SERVER: values.serverId.trim(),
                                MCPO_TOOL: values.toolName.trim(),
                                MCPO_STATIC_ARGS: staticArgs,
                        };

                        if (values.apiKey && values.apiKey.trim()) {
                                config.MCPO_API_KEY = values.apiKey.trim();
                        }

                        if (queryParam) {
                                config.MCPO_QUERY_PARAM = queryParam;
                        }

                        if (values.resultPath && values.resultPath.trim()) {
                                config.MCPO_RESULT_PATH = values.resultPath.trim();
                        }

                        if (timeoutValue !== undefined) {
                                config.MCPO_TIMEOUT = timeoutValue;
                        }

                        await createConnector({
                                name: values.name.trim(),
                                connector_type: EnumConnectorName.MCPO_CONNECTOR,
                                config,
                                is_indexable: false,
                                last_indexed_at: null,
                        });

                        toast.success("MCPO connector created successfully!");
                        router.push(`/dashboard/${searchSpaceId}/connectors`);
                } catch (error) {
                        console.error("Error creating MCPO connector:", error);
                        toast.error(error instanceof Error ? error.message : "Failed to create connector");
                } finally {
                        setIsSubmitting(false);
                }
        };

        return (
                <div className="container mx-auto py-8 max-w-3xl">
                        <Button
                                variant="ghost"
                                className="mb-6"
                                onClick={() => router.push(`/dashboard/${searchSpaceId}/connectors/add`)}
                        >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Connectors
                        </Button>

                        <div className="mb-8">
                                <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-lg">
                                                {getConnectorIcon(EnumConnectorName.MCPO_CONNECTOR, "h-6 w-6")}
                                        </div>
                                        <div>
                                                <h1 className="text-3xl font-bold tracking-tight">Connect MCPO</h1>
                                                <p className="text-muted-foreground">
                                                        Use the MCPO Control Panel to orchestrate MCP servers and expose their tools inside SurfSense.
                                                </p>
                                        </div>
                                </div>
                        </div>

                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                                <Tabs defaultValue="connect" className="w-full">
                                        <TabsList className="grid w-full grid-cols-2 mb-6">
                                                <TabsTrigger value="connect">Connect</TabsTrigger>
                                                <TabsTrigger value="documentation">Documentation</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="connect">
                                                <Card className="border-2 border-border">
                                                        <CardHeader>
                                                                <CardTitle className="text-2xl font-bold">Connect MCPO Control Panel</CardTitle>
                                                                <CardDescription>
                                                                        Provide the details of your MCPO deployment to access MCP tools within SurfSense.
                                                                </CardDescription>
                                                        </CardHeader>
                                                        <CardContent>
                                                                <Alert className="mb-6 bg-muted">
                                                                        <Info className="h-4 w-4" />
                                                                        <AlertTitle>MCPO server required</AlertTitle>
                                                                        <AlertDescription>
                                                                                Ensure the MCPO Control Panel is running and exposes the MCP servers you want to use. Use dot-separated paths (for example, <code>results.0.items</code>) to select nested data in the tool response.
                                                                        </AlertDescription>
                                                                </Alert>

                                                                <Form {...form}>
                                                                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                                                                <FormField
                                                                                        control={form.control}
                                                                                        name="name"
                                                                                        render={({ field }) => (
                                                                                                <FormItem>
                                                                                                        <FormLabel>Connector Name</FormLabel>
                                                                                                        <FormControl>
                                                                                                                <Input placeholder="My MCPO Connector" {...field} />
                                                                                                        </FormControl>
                                                                                                        <FormDescription>A friendly name to identify this connector.</FormDescription>
                                                                                                        <FormMessage />
                                                                                                </FormItem>
                                                                                        )}
                                                                                />

                                                                                <FormField
                                                                                        control={form.control}
                                                                                        name="baseUrl"
                                                                                        render={({ field }) => (
                                                                                                <FormItem>
                                                                                                        <FormLabel>MCPO Base URL</FormLabel>
                                                                                                        <FormControl>
                                                                                                                <Input placeholder="https://mcpo.yourdomain.com" {...field} />
                                                                                                        </FormControl>
                                                                                                        <FormDescription>
                                                                                                                URL where your MCPO Control Panel exposes the proxied MCP tools.
                                                                                                        </FormDescription>
                                                                                                        <FormMessage />
                                                                                                </FormItem>
                                                                                        )}
                                                                                />

                                                                                <div className="grid gap-4 md:grid-cols-2">
                                                                                        <FormField
                                                                                                control={form.control}
                                                                                                name="serverId"
                                                                                                render={({ field }) => (
                                                                                                        <FormItem>
                                                                                                                <FormLabel>Server Identifier</FormLabel>
                                                                                                                <FormControl>
                                                                                                                        <Input placeholder="e.g. github" {...field} />
                                                                                                                </FormControl>
                                                                                                                <FormDescription>
                                                                                                                        Matches the server path configured in MCPO (appears after the base URL).
                                                                                                                </FormDescription>
                                                                                                                <FormMessage />
                                                                                                        </FormItem>
                                                                                                )}
                                                                                        />
                                                                                        <FormField
                                                                                                control={form.control}
                                                                                                name="toolName"
                                                                                                render={({ field }) => (
                                                                                                        <FormItem>
                                                                                                                <FormLabel>Tool Name</FormLabel>
                                                                                                                <FormControl>
                                                                                                                        <Input placeholder="search" {...field} />
                                                                                                                </FormControl>
                                                                                                                <FormDescription>The MCP tool name exactly as exposed by MCPO.</FormDescription>
                                                                                                                <FormMessage />
                                                                                                        </FormItem>
                                                                                                )}
                                                                                        />
                                                                                </div>

                                                                                <FormField
                                                                                        control={form.control}
                                                                                        name="apiKey"
                                                                                        render={({ field }) => (
                                                                                                <FormItem>
                                                                                                        <FormLabel>API Key (optional)</FormLabel>
                                                                                                        <FormControl>
                                                                                                                <Input type="password" placeholder="MCPO API key" {...field} />
                                                                                                        </FormControl>
                                                                                                        <FormDescription>
                                                                                                                Provide if your MCPO deployment requires Bearer authentication.
                                                                                                        </FormDescription>
                                                                                                        <FormMessage />
                                                                                                </FormItem>
                                                                                        )}
                                                                                />

                                                                                <div className="grid gap-4 md:grid-cols-2">
                                                                                        <FormField
                                                                                                control={form.control}
                                                                                                name="queryParam"
                                                                                                render={({ field }) => (
                                                                                                        <FormItem>
                                                                                                                <FormLabel>Query Parameter</FormLabel>
                                                                                                                <FormControl>
                                                                                                                        <Input placeholder="query" {...field} />
                                                                                                                </FormControl>
                                                                                                                <FormDescription>
                                                                                                                        Name of the argument that will receive the user's question. Defaults to <code>query</code>.
                                                                                                                </FormDescription>
                                                                                                                <FormMessage />
                                                                                                        </FormItem>
                                                                                                )}
                                                                                        />
                                                                                        <FormField
                                                                                                control={form.control}
                                                                                                name="timeout"
                                                                                                render={({ field }) => (
                                                                                                        <FormItem>
                                                                                                                <FormLabel>Timeout (seconds)</FormLabel>
                                                                                                                <FormControl>
                                                                                                                        <Input placeholder="30" {...field} />
                                                                                                                </FormControl>
                                                                                                                <FormDescription>Optional request timeout. Must be a positive number.</FormDescription>
                                                                                                                <FormMessage />
                                                                                                        </FormItem>
                                                                                                )}
                                                                                        />
                                                                                </div>

                                                                                <FormField
                                                                                        control={form.control}
                                                                                        name="staticArgs"
                                                                                        render={({ field }) => (
                                                                                                <FormItem>
                                                                                                        <FormLabel>Static Arguments (JSON)</FormLabel>
                                                                                                        <FormControl>
                                                                                                                <Textarea
                                                                                                                        placeholder='{"includeEvidence": true}'
                                                                                                                        className="min-h-[120px]"
                                                                                                                        {...field}
                                                                                                                />
                                                                                                        </FormControl>
                                                                                                        <FormDescription>
                                                                                                                Optional JSON object merged into every MCPO request.
                                                                                                        </FormDescription>
                                                                                                        <FormMessage />
                                                                                                </FormItem>
                                                                                        )}
                                                                                />

                                                                                <FormField
                                                                                        control={form.control}
                                                                                        name="resultPath"
                                                                                        render={({ field }) => (
                                                                                                <FormItem>
                                                                                                        <FormLabel>Result Path (optional)</FormLabel>
                                                                                                        <FormControl>
                                                                                                                <Input placeholder="results" {...field} />
                                                                                                        </FormControl>
                                                                                                        <FormDescription>
                                                                                                                Dot-separated path to select the relevant array from the tool response. Use numeric segments to index lists.
                                                                                                        </FormDescription>
                                                                                                        <FormMessage />
                                                                                                </FormItem>
                                                                                        )}
                                                                                />

                                                                                <div className="flex justify-end">
                                                                                        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                                                                                                {isSubmitting ? (
                                                                                                        <>
                                                                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                                                                Connecting...
                                                                                                        </>
                                                                                                ) : (
                                                                                                        "Create Connector"
                                                                                                )}
                                                                                        </Button>
                                                                                </div>
                                                                        </form>
                                                                </Form>
                                                        </CardContent>
                                                        <CardFooter className="flex-col items-start gap-2 text-sm text-muted-foreground">
                                                                <p>
                                                                        Once connected, SurfSense will call your configured MCP tool in real time when MCPO sources are selected.
                                                                </p>
                                                        </CardFooter>
                                                </Card>
                                        </TabsContent>

                                        <TabsContent value="documentation">
                                                <Card className="border-2 border-border">
                                                        <CardHeader>
                                                                <CardTitle>MCPO Setup Guide</CardTitle>
                                                                <CardDescription>
                                                                        Tips for preparing the MCPO Control Panel and integrating MCP servers with SurfSense.
                                                                </CardDescription>
                                                        </CardHeader>
                                                        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                                                                <p>
                                                                        1. Install the MCPO Control Panel and configure the MCP servers you want to expose. Each server appears under the Control Panel's base URL, e.g. <code>https://mcpo.example.com/github</code>.
                                                                </p>
                                                                <p>
                                                                        2. Identify the tool you wish to call for a given server. The tool name is available in the MCPO documentation UI or via the OpenAPI schema. Provide that value in the Tool Name field above.
                                                                </p>
                                                                <p>
                                                                        3. If the tool requires additional arguments besides the query, include them in the static arguments JSON. They will be merged into every MCPO request.
                                                                </p>
                                                                <p>
                                                                        4. Use the result path to specify where SurfSense should read the list of results. For example, if the response is <code>{"{\"results\": [ ... ]}"}</code>, use <code>results</code>. To index into nested arrays use dot notation such as <code>results.0.items</code>.
                                                                </p>
                                                                <p>
                                                                        5. For secured deployments, supply the MCPO API key. SurfSense sends it using the <code>Authorization: Bearer</code> header.
                                                                </p>
                                                        </CardContent>
                                                </Card>
                                        </TabsContent>
                                </Tabs>
                        </motion.div>
                </div>
        );
}
