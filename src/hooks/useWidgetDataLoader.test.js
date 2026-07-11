import { act, renderHook, waitFor } from "@testing-library/react";

import useWidgetDataLoader from "./useWidgetDataLoader";

describe("useWidgetDataLoader request ownership", () => {
  test("loads once initially, once per dependency change, and once per manual refresh", async () => {
    const fetcher = jest.fn(async () => ({ loaded: true }));
    const { result, rerender } = renderHook(
      ({ dependency }) => useWidgetDataLoader(fetcher, {
        dependencies: [dependency],
        initialData: null,
        maxRetries: 0,
      }),
      { initialProps: { dependency: "first" } }
    );

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(fetcher).toHaveBeenCalledTimes(1);

    rerender({ dependency: "second" });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.status).toBe("success"));

    await act(async () => {
      await result.current.refresh();
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
