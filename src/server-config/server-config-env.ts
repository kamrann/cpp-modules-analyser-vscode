
export interface EnvOverrides {
  toolchainRoot: string | undefined;
  dumpTrace: boolean;
  traceCategories: Array<string>;
  dumpProfilingDir: string | undefined;
  waitDebugger: number | undefined;
}

export function getEnvConfigurationOverrides(): EnvOverrides {
  return {
    toolchainRoot: process.env.CPP_MODULES_ANALYSER_TOOLCHAIN_ROOT,
    dumpTrace: process.env.CPP_MODULES_DUMP_TRACE !== undefined,
    traceCategories: process.env.CPP_MODULES_ANALYSER_TRACE_CATEGORIES?.split(",").map((x: string) => x.trim()) ?? [],
    dumpProfilingDir: process.env.CPP_MODULES_ANALYSER_DUMP_PROFILING_DIR,
    waitDebugger: process.env.CPP_MODULES_WAIT_DEBUGGER ? Number(process.env.CPP_MODULES_WAIT_DEBUGGER) : undefined,
  };
}
