
export interface EnvOverrides {
  toolchainRoot: string | undefined;
  dumpTrace: boolean;
  waitDebugger: number | undefined;
}

export function getEnvConfigurationOverrides(): EnvOverrides {
  return {
    toolchainRoot: process.env.CPP_MODULES_ANALYSER_TOOLCHAIN_ROOT,
    dumpTrace: process.env.CPP_MODULES_DUMP_TRACE !== undefined,
    waitDebugger: process.env.CPP_MODULES_WAIT_DEBUGGER ? Number(process.env.CPP_MODULES_WAIT_DEBUGGER) : undefined,
  };
}
