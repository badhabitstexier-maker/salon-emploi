interface EventConfig {
  edition: string;
  dateLabel: string;
  dateDetail: string;
  exactDatesKnown: boolean;
  startDate: string | null;
  endDate: string | null;
  locationName: string;
  locationCity: string;
  locationLabel: string;
  hoursLabel: string;
}

/** Informations publiques de l'édition à venir. */
export const event: EventConfig = {
  edition: '2027',
  dateLabel: 'Avril 2027',
  dateDetail: 'Avril 2027 — dates précises à venir',
  exactDatesKnown: false,
  startDate: null,
  endDate: null,
  locationName: "Salle d'exposition de Nouville",
  locationCity: 'Nouméa',
  locationLabel: "Salle d'exposition de Nouville, Nouméa",
  hoursLabel: '9 h à 17 h',
};

export const eventName = `Salon de l'Emploi & de la Formation ${event.edition}`;
