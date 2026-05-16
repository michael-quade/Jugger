// Handicap index by player ID by year, sourced from JuggerHistory XLSM files.
// null = player was not present that year (sub played instead).
export const PLAYER_HDCP_HISTORY: Record<string, (number | null)[]> = {
  quade:       [15.0, 14.0, 14.5, 14.2, 17.3, 17.7, 15.6, 14.9, 14.9, 15.7, 15.3, 14.7, 14.6, 14.8, 14.8, 15.7, 15.7, 16.4, 14.9, 16.1, 13.7],
  holcomb:     [17.0, 15.0, 16.2, 17.7, 16.8, 16.1, 16.2, 15.2, 13.1, 14.8, 15.7, 14.8, 16.0, 16.8, 18.2, 16.5, 14.2, 14.7, 15.6, 16.0, 16.9],
  butterworth: [null, null, null, null, null, null, 24.7, 26.8, 20.4, 20.8, 22.7, 22.2, 19.0, 21.8, 22.5, 16.0, 12.6, 16.3, 15.8, 15.7, 12.9],
  whitman:     [null, null, null, null, null, null, 27.3, null, 21.0, null, 22.0, 23.0, 22.0, 20.8, 20.8, 16.7, 17.2, 16.7, 16.4, 15.9, 15.4],
  pitts:       [14.0, 13.0, 13.2, 12.7, 11.9, 10.7, 10.0, 10.1, 10.4, 12.9, 13.0, 12.9, 10.4, 12.0, 14.7, 13.6, 13.3, 11.2, 12.4, 13.4, 11.5],
  gunter:      [16.0, 18.0, 17.0, 17.3, 14.5, 15.2, 14.4, 15.1, 15.2, 15.0, 13.6, 13.0, 14.3, 14.9, 16.5, 17.1, 16.9, 17.7, 17.1, 16.5, 18.7],
  oxford:      [20.0, 17.0, null, null, null, 17.0, 15.0, 15.0, 13.5, 14.5, 13.1, 12.2, 11.2, 11.3, 11.2, 12.6, 10.4, 10.5, 11.1, 11.9,  9.1],
  oncavage:    [ 9.0,  9.0, 10.0,  8.2,  6.5,  6.4, null,  6.5,  6.1,  6.7,  6.8,  8.1,  8.0,  7.5,  7.3,  7.7,  7.9,  8.0,  8.6, 10.9,  8.0],
  woyahn:      [ 3.0,  6.0,  6.9,  5.8,  6.1,  6.1,  7.0,  6.1,  7.6,  5.9,  8.0,  8.6,  6.4,  8.0,  6.1,  5.8,  5.6,  6.3,  6.3,  6.7,  8.1],
  skidmore:    [33.0, 30.0, null, 25.7, 25.0, 21.5, 21.6, 20.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 14.0, 29.3, 29.5, 28.1, 28.5, 28.5],
  bender:      [11.0, 12.0, 13.0, 11.5, 11.0,  9.8,  7.3,  5.0,  4.7,  5.3,  7.6,  5.0,  7.1,  6.9,  7.8,  7.8,  7.9,  7.5,  7.0,  7.0,  7.0],
  morris:      [null, null, null, null, null, null, 10.4,  9.5,  8.8,  8.2,  9.0, null, null, 10.3, 10.5, 10.4,  5.9,  7.0,  6.2,  6.2,  7.2],
}

// Corresponding years for each index position
export const HDCP_YEARS = [
  2006, 2007, 2008, 2009, 2010, 2011,
  2012, 2013, 2014, 2015, 2016, 2017,
  2018, 2019, 2020, 2021, 2022, 2023,
  2024, 2025, 2026,
]

// Build a flat array suitable for recharts: [{year, quade, holcomb, ...}, ...]
export function buildHdcpChartData() {
  return HDCP_YEARS.map((year, i) => {
    const row: Record<string, number | string | null> = { year }
    for (const [id, values] of Object.entries(PLAYER_HDCP_HISTORY)) {
      row[id] = values[i]
    }
    return row
  })
}
