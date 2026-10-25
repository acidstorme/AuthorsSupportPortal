import { beforeEach, describe, expect, it, vi } from "vitest";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { useExclusiveMutation } from "../../src/features/tickets/use-exclusive-mutation";

// Exercise the hook's event handler with the real mutation lifecycle, without
// requiring a DOM just to supply a persistent ref.
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useRef: (current: unknown) => ({ current }),
}));
vi.mock("@tanstack/react-query", async (original) => ({
  ...await original<typeof import("@tanstack/react-query")>(),
  useMutation: (options: ConstructorParameters<typeof MutationObserver>[1]) => {
    const observer = new MutationObserver(new QueryClient(), options);
    return { mutateAsync: (variables: unknown) => observer.mutate(variables) };
  },
}));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("exclusive submissions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks rapid submissions through the response and awaited UI refresh", async () => {
    const response = deferred();
    const refresh = deferred();
    const mutationFn = vi.fn(async (_input: string) => { await response.promise; return _input; });
    const onSuccess = vi.fn(async () => { await refresh.promise; });
    const mutation = useExclusiveMutation({ mutationFn, onSuccess });
    mutation.mutate("first");
    mutation.mutate("duplicate");
    await vi.waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1));
    response.resolve();
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    mutation.mutate("during refresh");
    expect(mutationFn).toHaveBeenCalledTimes(1);
    refresh.resolve();
    await new Promise((done) => setTimeout(done, 0));
    mutation.mutate("next intentional action");
    await vi.waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(2));
  });

  it("unlocks after an error so the same request can be retried", async () => {
    const response = deferred();
    const mutationFn = vi.fn(async (_input: string) => { await response.promise; throw new Error(`Offline: ${_input}`); });
    const onError = vi.fn();
    const mutation = useExclusiveMutation({ mutationFn, onError });
    mutation.mutate("stable request ID");
    mutation.mutate("stable request ID");
    response.resolve();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    mutation.mutate("stable request ID");
    await vi.waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(2));
    expect(mutationFn.mock.calls.map(([id]) => id)).toEqual(["stable request ID", "stable request ID"]);
  });
});
