import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { DEFAULT_ROSTER_SIZE, type SpatialTopology, type TemporalTopology } from "@frc-fantasy/shared";
import { useTRPC } from "../../lib/trpc";

const CURRENT_YEAR = new Date().getFullYear();

export function CreateLeagueWizard() {
  const trpc = useTRPC();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [commissionerTeamName, setCommissionerTeamName] = useState("");
  const [spatialTopology, setSpatialTopology] = useState<SpatialTopology>("global");
  const [districtKey, setDistrictKey] = useState("");
  const [districtEntryMode, setDistrictEntryMode] = useState<"list" | "manual">("list");
  const [temporalTopology, setTemporalTopology] = useState<TemporalTopology>("season_long");
  const [tbaEventKey, setTbaEventKey] = useState("");
  const [eventEntryMode, setEventEntryMode] = useState<"list" | "manual">("list");
  const [rosterSize, setRosterSize] = useState(DEFAULT_ROSTER_SIZE);

  const districts = useQuery({
    ...trpc.event.listDistricts.queryOptions({ year: CURRENT_YEAR }),
    enabled: spatialTopology === "district",
  });

  const upcomingEvents = useQuery({
    ...trpc.event.listUpcoming.queryOptions({ year: CURRENT_YEAR }),
    enabled: temporalTopology !== "season_long",
  });

  const createLeague = useMutation(
    trpc.league.create.mutationOptions({
      onSuccess: async (league) => {
        await navigate({ to: "/leagues/$leagueId", params: { leagueId: league.id } });
      },
    }),
  );

  return (
    <form
      className="league-wizard"
      onSubmit={(e) => {
        e.preventDefault();
        createLeague.mutate({
          name,
          commissionerTeamName,
          spatialTopology,
          districtKey: spatialTopology === "district" ? districtKey : undefined,
          temporalTopology,
          tbaEventKey: temporalTopology !== "season_long" ? tbaEventKey : undefined,
          seasonYear: CURRENT_YEAR,
          rosterSize,
        });
      }}
    >
      <section className="card">
        <h2>League basics</h2>
        <label>
          League name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Your fantasy team name
          <input value={commissionerTeamName} onChange={(e) => setCommissionerTeamName(e.target.value)} required />
        </label>
      </section>

      <section className="card">
        <h2>Spatial topology</h2>
        <div className="topology-cards">
          <TopologyCard
            title="Global"
            description="Draft from any FRC team, anywhere in the world."
            selected={spatialTopology === "global"}
            onClick={() => setSpatialTopology("global")}
          />
          <TopologyCard
            title="District-specific"
            description="Restrict scoring/rankings to one FRC district."
            selected={spatialTopology === "district"}
            onClick={() => setSpatialTopology("district")}
          />
        </div>
        {spatialTopology === "district" && (
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
        <h2>Temporal topology</h2>
        <div className="topology-cards">
          <TopologyCard
            title="Season-long"
            description="One draft, scored across the whole season."
            selected={temporalTopology === "season_long"}
            onClick={() => setTemporalTopology("season_long")}
          />
          <TopologyCard
            title="Single event"
            description="A micro-league scoped to one event."
            selected={temporalTopology === "single_event"}
            onClick={() => setTemporalTopology("single_event")}
          />
          <TopologyCard
            title="Weekly event draft"
            description="Draft from one upcoming event's attendee list — built to encourage pre-event scouting."
            selected={temporalTopology === "weekly_event_draft"}
            onClick={() => setTemporalTopology("weekly_event_draft")}
          />
        </div>
        {temporalTopology !== "season_long" && (
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
        )}
      </section>

      <section className="card">
        <h2>Roster settings</h2>
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

      {createLeague.isError && <p className="form-error">{createLeague.error.message}</p>}
      <button type="submit" disabled={createLeague.isPending}>
        {createLeague.isPending ? "Creating league…" : "Create league"}
      </button>
    </form>
  );
}

function TopologyCard(props: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`topology-card ${props.selected ? "selected" : ""}`}
      onClick={props.onClick}
    >
      <strong>{props.title}</strong>
      <span>{props.description}</span>
    </button>
  );
}
