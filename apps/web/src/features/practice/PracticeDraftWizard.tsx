import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTRPC } from "../../lib/trpc";

const CURRENT_YEAR = new Date().getFullYear();

type PoolSource = "event" | "district";

export function PracticeDraftWizard() {
  const trpc = useTRPC();
  const navigate = useNavigate();

  const [commissionerTeamName, setCommissionerTeamName] = useState("");
  const [poolSource, setPoolSource] = useState<PoolSource>("event");
  const [districtKey, setDistrictKey] = useState("");
  const [districtEntryMode, setDistrictEntryMode] = useState<"list" | "manual">("list");
  const [tbaEventKey, setTbaEventKey] = useState("");
  const [eventEntryMode, setEventEntryMode] = useState<"list" | "manual">("list");
  const [botCount, setBotCount] = useState(3);
  const [rosterSize, setRosterSize] = useState(5);

  const districts = useQuery({
    ...trpc.event.listDistricts.queryOptions({ year: CURRENT_YEAR }),
    enabled: poolSource === "district",
  });
  const upcomingEvents = useQuery({
    ...trpc.event.listUpcoming.queryOptions({ year: CURRENT_YEAR }),
    enabled: poolSource === "event",
  });

  const createPracticeDraft = useMutation(
    trpc.practice.create.mutationOptions({
      onSuccess: async ({ leagueId }) => {
        await navigate({ to: "/leagues/$leagueId/draft", params: { leagueId } });
      },
    }),
  );

  return (
    <form
      className="league-wizard"
      onSubmit={(e) => {
        e.preventDefault();
        createPracticeDraft.mutate({
          commissionerTeamName,
          spatialTopology: poolSource === "district" ? "district" : "global",
          districtKey: poolSource === "district" ? districtKey : undefined,
          temporalTopology: poolSource === "event" ? "single_event" : "season_long",
          tbaEventKey: poolSource === "event" ? tbaEventKey : undefined,
          seasonYear: CURRENT_YEAR,
          rosterSize,
          botCount,
        });
      }}
    >
      <section className="card">
        <h2>Your team</h2>
        <label>
          Your fantasy team name
          <input value={commissionerTeamName} onChange={(e) => setCommissionerTeamName(e.target.value)} required />
        </label>
      </section>

      <section className="card">
        <h2>Draft from</h2>
        <div className="topology-cards">
          <button
            type="button"
            className={`topology-card ${poolSource === "event" ? "selected" : ""}`}
            onClick={() => setPoolSource("event")}
          >
            <strong>One event</strong>
            <span>Practice against that event's real attendee list.</span>
          </button>
          <button
            type="button"
            className={`topology-card ${poolSource === "district" ? "selected" : ""}`}
            onClick={() => setPoolSource("district")}
          >
            <strong>A district</strong>
            <span>Practice against every team in that district's season.</span>
          </button>
        </div>

        {poolSource === "event" ? (
          <>
            {eventEntryMode === "list" ? (
              <label>
                Event
                <select value={tbaEventKey} onChange={(e) => setTbaEventKey(e.target.value)} required>
                  <option value="" disabled>
                    {upcomingEvents.isLoading ? "Loading events…" : "Select an upcoming event"}
                  </option>
                  {upcomingEvents.data?.map((event) => (
                    <option key={event.key} value={event.key}>
                      {event.name} ({event.startDate})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Event code
                <input
                  value={tbaEventKey}
                  onChange={(e) => setTbaEventKey(e.target.value)}
                  placeholder="e.g. 2026mifim"
                  required
                />
              </label>
            )}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setTbaEventKey("");
                setEventEntryMode(eventEntryMode === "list" ? "manual" : "list");
              }}
            >
              {eventEntryMode === "list" ? "Type an event code instead" : "Pick from list instead"}
            </button>
          </>
        ) : (
          <>
            {districtEntryMode === "list" ? (
              <label>
                District
                <select value={districtKey} onChange={(e) => setDistrictKey(e.target.value)} required>
                  <option value="" disabled>
                    {districts.isLoading ? "Loading districts…" : "Select a district"}
                  </option>
                  {districts.data?.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.displayName} ({d.key})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                District code
                <input
                  value={districtKey}
                  onChange={(e) => setDistrictKey(e.target.value)}
                  placeholder="e.g. 2026fim, 2026ne, 2026pnw"
                  required
                />
              </label>
            )}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setDistrictKey("");
                setDistrictEntryMode(districtEntryMode === "list" ? "manual" : "list");
              }}
            >
              {districtEntryMode === "list" ? "Type a district code instead" : "Pick from list instead"}
            </button>
          </>
        )}
      </section>

      <section className="card">
        <h2>Opponents & roster</h2>
        <label>
          Number of bot opponents
          <input
            type="number"
            min={1}
            max={7}
            value={botCount}
            onChange={(e) => setBotCount(Number(e.target.value))}
            required
          />
        </label>
        <label>
          Draft picks / roster spots per manager
          <input
            type="number"
            min={1}
            max={30}
            value={rosterSize}
            onChange={(e) => setRosterSize(Number(e.target.value))}
            required
          />
        </label>
      </section>

      {createPracticeDraft.isError && <p className="form-error">{createPracticeDraft.error.message}</p>}
      <button type="submit" disabled={createPracticeDraft.isPending}>
        {createPracticeDraft.isPending ? "Setting up practice draft…" : "Start practice draft"}
      </button>
    </form>
  );
}
