class CampaignsController < ApplicationController
  before_action :find_campaign, only: [:update, :destroy]

  def index
    render json: Campaign.all
  end

  def create
    @campaign = Campaign.create(campaign_params)
    render json: @campaign
  end

  def update
    @campaign.update(campaign_params)
    render json: @plane
  end
  
  def destroy
    @campaign.destroy
    render json: { status: "ok"}
  end

private

  def find_campaign
    @campaign = Campaign.find(params[:id])
  end

  def campaign_params
    params.require(:campaign).permit(:name, :description)
  end

end
