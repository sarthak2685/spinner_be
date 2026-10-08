import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { DatabaseService } from '../../database/database.module';

@Injectable()
export class LocationsService {
  constructor(private readonly db: DatabaseService) {}
  countries() { return this.db.many(`SELECT countryid, countryname FROM public."Countries" ORDER BY countryname`); }
  states(countryId?: number) {
    if (countryId) return this.db.many(`SELECT stateid, statename FROM public."States" WHERE countryid = $1 ORDER BY statename`, [countryId]);
    return this.db.many(`SELECT stateid, statename, countryid FROM public."States" ORDER BY statename`);
  }
  districts(stateId: number) { return this.db.many(`SELECT districtid, districtname FROM public."Districts" WHERE stateid = $1 ORDER BY districtname`, [stateId]); }
  cities(districtId: number) { return this.db.many(`SELECT cityid, cityname FROM public."Cities" WHERE districtid = $1 ORDER BY cityname`, [districtId]); }
  activeTypes() { return this.db.many(`SELECT * FROM public."BusinessTypes" WHERE isactive = true ORDER BY displayorder, typename`); }
}

@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}
  @Get('countries') countries() { return this.locations.countries(); }
  @Get('states') states(@Query('countryId') countryId?: string) { return this.locations.states(countryId ? Number(countryId) : undefined); }
  @Get('districts') districts(@Query('stateId') stateId = '0') { return this.locations.districts(Number(stateId)); }
  @Get('cities') cities(@Query('districtId') districtId = '0') { return this.locations.cities(Number(districtId)); }
  @Get('business-types') types() { return this.locations.activeTypes(); }
}

@Module({ controllers: [LocationsController], providers: [LocationsService], exports: [LocationsService] })
export class LocationsModule {}
