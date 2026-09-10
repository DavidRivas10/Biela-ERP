import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BarcodeCameraModal } from "./BarcodeCameraModal";

const decodeFromConstraints = vi.fn();

vi.mock("@zxing/browser", () => {
  class BrowserMultiFormatReader {
    decodeFromConstraints = decodeFromConstraints;
  }
  return {
    BrowserMultiFormatReader,
    BarcodeFormat: new Proxy(
      {},
      { get: (_target, prop) => String(prop) },
    ) as Record<string, string>,
  };
});

vi.mock("@zxing/library", () => ({
  DecodeHintType: { POSSIBLE_FORMATS: 2, TRY_HARDER: 3 },
}));

afterEach(() => {
  decodeFromConstraints.mockReset();
  vi.useRealTimers();
});

describe("BarcodeCameraModal", () => {
  it("keeps manual code entry available while the camera is scanning", async () => {
    decodeFromConstraints.mockResolvedValue({ stop: vi.fn() });
    const onScan = vi.fn();
    const onClose = vi.fn();
    render(
      <BarcodeCameraModal open onScan={onScan} onClose={onClose} />,
    );

    const input = await screen.findByLabelText(/escribe el código del producto/i);
    await userEvent.type(input, "REP-FILT-1042");
    await userEvent.click(screen.getByRole("button", { name: "Usar código" }));

    expect(onScan).toHaveBeenCalledWith("REP-FILT-1042");
    expect(onClose).toHaveBeenCalled();
  });

  it("passes a 1080p + environment-facing constraint to the decoder", async () => {
    decodeFromConstraints.mockResolvedValue({ stop: vi.fn() });
    render(<BarcodeCameraModal open onScan={vi.fn()} onClose={vi.fn()} />);

    await screen.findByLabelText(/escribe el código del producto/i);
    const [constraints] = decodeFromConstraints.mock.calls[0] as [
      MediaStreamConstraints,
    ];
    const video = constraints.video as MediaTrackConstraints;
    expect(video.facingMode).toEqual({ ideal: "environment" });
    expect(video.width).toEqual({ ideal: 1920 });
    expect(video.height).toEqual({ ideal: 1080 });
  });

  it("surfaces a help hint after several seconds without a read", async () => {
    vi.useFakeTimers();
    decodeFromConstraints.mockResolvedValue({ stop: vi.fn() });
    render(<BarcodeCameraModal open onScan={vi.fn()} onClose={vi.fn()} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByText(/todavía no se detecta/i)).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });
    expect(screen.getByText(/todavía no se detecta ningún código/i)).toBeVisible();
  });

  it("still offers manual entry when the camera cannot start", async () => {
    decodeFromConstraints.mockRejectedValue(
      Object.assign(new Error("denied"), { name: "NotAllowedError" }),
    );
    const onScan = vi.fn();
    const onClose = vi.fn();
    render(
      <BarcodeCameraModal open onScan={onScan} onClose={onClose} />,
    );

    expect(
      await screen.findByText(/no se concedió permiso para usar la cámara/i),
    ).toBeVisible();
    const input = screen.getByLabelText("Escribe el código del producto");
    await userEvent.type(input, "ABC123");
    await userEvent.click(screen.getByRole("button", { name: "Usar código" }));
    expect(onScan).toHaveBeenCalledWith("ABC123");
    expect(onClose).toHaveBeenCalled();
  });
});
