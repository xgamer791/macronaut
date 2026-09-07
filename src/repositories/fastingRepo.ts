import { api } from '../../convex/_generated/api';
import { ConvexCaller } from './convexCall';

export interface FastingSlot {
  id: string;
  label: string;
  durationMinutes: number;
}

export interface FastingState {
  activeStartAt: number | null;
  activeEndAt: number | null;
  customSlots: FastingSlot[];
  updatedAt: string | null;
}

export interface FastingRepo {
  state(): Promise<FastingState>;
  start(startAt: number, endAt: number): Promise<void>;
  stop(): Promise<void>;
  saveSlot(label: string, durationMinutes: number): Promise<FastingSlot>;
  removeSlot(id: string): Promise<void>;
}

export function createFastingRepo(convex: ConvexCaller): FastingRepo {
  return {
    state: () => convex.query(api.fasting.state, {}),
    async start(startAt, endAt) {
      await convex.mutation(api.fasting.start, { startAt, endAt });
    },
    async stop() {
      await convex.mutation(api.fasting.stop, {});
    },
    saveSlot: (label, durationMinutes) =>
      convex.mutation(api.fasting.saveSlot, { label, durationMinutes }),
    async removeSlot(id) {
      await convex.mutation(api.fasting.removeSlot, { id });
    },
  };
}
