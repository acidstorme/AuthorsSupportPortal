import { beforeEach, expect, it, vi } from "vitest";
import { NewTicket } from "../../src/features/tickets/client";

const harness = vi.hoisted(() => ({
  states: [] as unknown[], refs: [] as { current: unknown }[], stateIndex: 0, refIndex: 0,
  mutate: vi.fn(), replace: vi.fn(), invalidate: vi.fn(),
  options: null as null | { onSuccess: (result: { data: { id: string } }) => void },
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = harness.stateIndex++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: unknown) => { harness.states[index] = value; }];
  },
  useRef: (initial: unknown) => {
    const index = harness.refIndex++;
    return harness.refs[index] ??= { current: initial };
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: harness.replace }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: harness.invalidate }) }));
vi.mock("../../src/features/tickets/use-exclusive-mutation", () => ({
  useExclusiveMutation: (options: typeof harness.options) => {
    harness.options = options;
    return { mutate: harness.mutate, isPending: false, error: null };
  },
}));

function renderForm() {
  harness.stateIndex = 0; harness.refIndex = 0;
  return NewTicket({ books: [] });
}

beforeEach(() => {
  vi.clearAllMocks(); harness.states = []; harness.refs = [];
  // A slow home-page refresh must not hold up opening the created ticket.
  harness.invalidate.mockReturnValue(new Promise(() => {}));
});

it("keeps creation locked after success even when navigation has not completed", () => {
  const form = renderForm();
  form.props.onSubmit({ preventDefault() {} });
  expect(harness.mutate).toHaveBeenCalledOnce();
  harness.options!.onSuccess({ data: { id: "created-ticket" } });
  expect(harness.replace).toHaveBeenCalledWith("/author/tickets/created-ticket");
  // Also guard a submit delivered before React has rerendered the disabled button.
  form.props.onSubmit({ preventDefault() {} });
  const updated = renderForm();
  updated.props.onSubmit({ preventDefault() {} });
  expect(harness.mutate).toHaveBeenCalledOnce();
  const button = updated.props.children.at(-1);
  expect(button.props.disabled).toBe(true);
  expect(button.props.children).toBe("Opening ticket…");
});

it("reuses the request ID when retrying unchanged input after an error", () => {
  const form = renderForm();
  form.props.onSubmit({ preventDefault() {} });
  const retry = renderForm();
  retry.props.onSubmit({ preventDefault() {} });
  const [first, second] = harness.mutate.mock.calls;
  expect(first[0].requestId).toBeTruthy();
  expect(second[0].requestId).toBe(first[0].requestId);
});
